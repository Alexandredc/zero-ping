import { z } from "zod"
import type { ChatMessage, PullInsight } from "@/server/db/schema"
import type { UatStatus } from "@/server/github/uat"
import type { InsightSpec } from "@/lib/insights"
import type { PullFile } from "@/server/github/pull-files"

/** The diff the AI reads for a question on a PR, cut to keep the prompt fast. */
const MAX_DIFF_CHARS = 60_000
/** Earlier exchanges kept in the prompt, so follow-up questions make sense. */
const MAX_HISTORY = 10

export const CHAT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: {
    answer: {
      type: "string",
      description: "The answer, in French Markdown.",
    },
  },
}

export function buildChatPrompt(readerLogin: string): string {
  return [
    `Answer the question of ${readerLogin}, a lead developer, about the GitHub item given on stdin.`,
    "The input holds the item, its GitHub conversation, the Slack threads found about it, its facts (Jev's KPIs, its status and priority on the team's GitHub project, whether a pull request runs on uat), the diff for a pull request, then the earlier exchanges and the question.",
    "Write in French, plainly and briefly; use Markdown and code references (file:line) when they help. Name people with their handle.",
    "Only use what the input says. When it does not hold the answer, say so instead of guessing. Do not use any tool.",
  ].join("\n")
}

/** The patches of a PR's files, in order, until the size budget runs out. */
export function formatDiff(files: PullFile[], max = MAX_DIFF_CHARS): string {
  const parts: string[] = []
  let size = 0
  let skipped = 0
  for (const file of files) {
    const block = `--- ${file.filename} (+${file.additions} -${file.deletions})\n${file.patch ?? "(binary or too large to show)"}`
    if (size + block.length > max) {
      skipped += 1
      continue
    }
    parts.push(block)
    size += block.length
  }
  if (skipped > 0)
    parts.push(
      `(${skipped} more file${skipped > 1 ? "s" : ""} left out for size)`
    )
  return parts.join("\n")
}

const UNSURE = 0.5

function insightValue(spec: InsightSpec, insight: PullInsight): string {
  const value =
    spec.kind === "levels"
      ? spec.levels[
          Math.min(Math.max(insight.level, 0), spec.levels.length - 1)
        ]
      : insight.level === 1
        ? spec.yes
        : spec.no
  return (insight.confidence ?? 1) < UNSURE ? `${value} (Jev is unsure)` : value
}

function uatLine(status: UatStatus): string {
  if (status.state === "merged")
    return "on uat: yes, its merge commit is in uat"
  const state = {
    deployed: "yes",
    partial: `partly, ${status.shipped} of ${status.total} commits`,
    reverted: "no, deployed then reverted",
    absent: "no",
  }[status.state]
  return [
    `on uat: ${state}`,
    status.missing.length > 0 && `missing: ${status.missing.join("; ")}`,
    status.outdated.length > 0 &&
      `rewritten since their deploy: ${status.outdated.join("; ")}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** What the app knows of the item besides its conversation, for the AI to answer with. */
export function formatItemFacts(facts: {
  insights: PullInsight[]
  specs: InsightSpec[]
  project: {
    title: string
    status: string | null
    priority: string | null
    via: number | null
  } | null
  uat: UatStatus | null
}): string | null {
  const lines: string[] = []
  if (facts.project)
    lines.push(
      `- Project « ${facts.project.title} »${facts.project.via ? ` (card of issue #${facts.project.via}, which it closes)` : ""}: status ${facts.project.status ?? "none"}, priority ${facts.project.priority ?? "none"}`
    )
  if (facts.uat) lines.push(`- ${uatLine(facts.uat)}`)
  const byId = new Map(facts.insights.map((insight) => [insight.id, insight]))
  const kpis = facts.specs.flatMap((spec) => {
    const insight = byId.get(spec.id)
    return insight ? [`  - ${spec.label}: ${insightValue(spec, insight)}`] : []
  })
  if (kpis.length > 0) lines.push("- Jev's KPIs:", ...kpis)
  return lines.length > 0 ? lines.join("\n") : null
}

export function buildChatInput(
  context: string,
  facts: string | null,
  diff: string | null,
  history: ChatMessage[],
  question: string
): string {
  const lines = [context]
  if (facts) lines.push("", "## Facts", facts)
  if (diff) lines.push("", "## Diff", diff)
  const earlier = history.slice(-MAX_HISTORY)
  if (earlier.length > 0)
    lines.push(
      "",
      "## Earlier exchanges",
      ...earlier.map(
        (message) =>
          `${message.role === "user" ? "Question" : "Answer"}: ${message.content}`
      )
    )
  lines.push("", "## Question", question)
  return lines.join("\n")
}

export function parseChatAnswer(answer: unknown): string {
  return z
    .object({ answer: z.string().min(1) })
    .parse(answer)
    .answer.trim()
}
