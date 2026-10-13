import { createHash } from "node:crypto"
import { experimental_decide } from "ai"
import type { Experimental_DecisionModel } from "ai"
import type { PullInsight } from "@/server/db/schema"
import type { Conversation } from "@/server/github/conversation"
import type { PullFile } from "@/server/github/pull-files"
import { confidenceOf } from "./triage"
import { INSIGHTS } from "@/lib/insights"
import type { InsightSpec } from "@/lib/insights"

const MAX_PATCH_CHARS = 20_000

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** What Jev reads: the PR's facts, its files and the start of the diff. */
export function buildInsightState(
  conversation: Conversation,
  files: PullFile[],
  facts: { ciState: string | null; reviewDecision: string | null }
) {
  let budget = MAX_PATCH_CHARS
  const patches: { file: string; patch: string }[] = []
  for (const file of files) {
    if (!file.patch || budget <= 0) continue
    const patch = truncate(file.patch, budget)
    budget -= patch.length
    patches.push({ file: file.filename, patch })
  }
  const threads = conversation.entries.filter(
    (entry) => entry.type === "thread"
  )
  return {
    title: conversation.title,
    description: truncate(conversation.description.body, 4000),
    state: conversation.state,
    ci: facts.ciState,
    reviewDecision: facts.reviewDecision,
    unresolvedThreads: threads.filter((thread) => !thread.isResolved).length,
    files: files.slice(0, 150).map((file) => ({
      name: file.filename,
      status: file.status,
      added: file.additions,
      removed: file.deletions,
    })),
    latestComments: conversation.entries
      .filter((entry) => entry.type !== "thread")
      .slice(-3)
      .map((entry) => ({
        author: entry.author,
        body: truncate(entry.body, 600),
      })),
    diff: patches,
  }
}

export function insightHash(state: unknown): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex")
}

/** What Jev reads of an issue: its description, labels and latest comments. */
export function buildIssueInsightState(
  conversation: Conversation,
  labels: string[],
  readerLogin: string
) {
  return {
    reader: readerLogin,
    title: conversation.title,
    description: truncate(conversation.description.body, 6000),
    state: conversation.state,
    labels,
    author: conversation.description.author,
    comments: conversation.entries
      .filter((entry) => entry.type !== "thread")
      .slice(-8)
      .map((entry) => ({
        author: entry.author,
        body: truncate(entry.body, 800),
      })),
  }
}

export async function computeInsights(
  model: Experimental_DecisionModel,
  state:
    | ReturnType<typeof buildInsightState>
    | ReturnType<typeof buildIssueInsightState>,
  specs: InsightSpec[] = INSIGHTS
): Promise<PullInsight[]> {
  const questions = Object.fromEntries(
    specs.map((spec) => [
      spec.id,
      spec.kind === "levels"
        ? {
            type: "score" as const,
            instructions: spec.instructions,
            criteria: spec.criteria,
          }
        : { type: "boolean" as const, instructions: spec.instructions },
    ])
  )
  const result = await experimental_decide({ model, state, questions })
  return specs.flatMap((spec): PullInsight[] => {
    const answer = result.answers[spec.id] as
      | { type: "score"; score: number }
      | { type: "boolean"; probability: number }
      | { type: "refusal" }
      | undefined
    const confidence = confidenceOf(result.providerMetadata, spec.id)
    if (answer?.type === "score")
      return [
        {
          id: spec.id,
          level: Math.round(answer.score),
          value: answer.score,
          confidence,
        },
      ]
    if (answer?.type === "boolean")
      return [
        {
          id: spec.id,
          level: answer.probability >= 0.5 ? 1 : 0,
          value: answer.probability,
          confidence,
        },
      ]
    return []
  })
}
