import { createHash } from "node:crypto"
import { experimental_decide } from "ai"
import type { Experimental_DecisionModel } from "ai"
import { createSwrCache } from "@/server/cache/swr"
import { WAIT_REASONS, needsWaitCheck, withWait } from "./rules"
import type { Readiness, ReadinessGap, WaitReason } from "./rules"

export type WaitInput = {
  number: number
  title: string
  body: string
  author: string | null
  labels: string[]
  comments: { author: string | null; body: string; createdAt: string }[]
}

const MAX_COMMENTS = 10

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** What Jev reads: the PR's own words, never its diff. */
export function buildWaitState(input: WaitInput) {
  return {
    number: input.number,
    title: input.title,
    author: input.author,
    labels: input.labels,
    description: truncate(input.body, 3000),
    latestComments: [...input.comments]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-MAX_COMMENTS)
      .map((comment) => ({
        author: comment.author,
        at: comment.createdAt,
        body: truncate(comment.body, 800),
      })),
  }
}

export function waitHash(input: WaitInput): string {
  return createHash("sha256")
    .update(JSON.stringify(buildWaitState(input)))
    .digest("hex")
}

const PULL_REFERENCE = /(?:(?:^|[^\w&/])#|\/pull\/)(\d+)\b/g

/**
 * The PR this one waits for, read from its own words: the newest comment
 * first, then the description, skipping references to itself.
 */
export function referencedPull(input: WaitInput): number | null {
  const texts = [
    ...[...input.comments]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((comment) => comment.body),
    input.body,
  ]
  for (const text of texts) {
    for (const match of text.matchAll(PULL_REFERENCE)) {
      const number = Number(match[1])
      if (number !== input.number) return number
    }
  }
  return null
}

const WAIT_CRITERIA: Record<WaitReason, string> = {
  dependency:
    "Another pull request or change has to be merged or deployed first.",
  hold: "Someone asked not to merge yet, or not before a date, an event or a sign-off.",
  freeze: "A deploy, release or merge freeze is in place.",
  label:
    "A label such as do-not-merge, on-hold, wip or blocked says to hold it.",
  question:
    "The author asked a question about this pull request that nobody has answered yet.",
  other: "Another reason to wait, or nothing says to wait.",
}

/** Probability from which Jev's yes counts. */
const WAIT_THRESHOLD = 0.5

export async function askWait(
  model: Experimental_DecisionModel,
  input: WaitInput
): Promise<ReadinessGap | null> {
  const result = await experimental_decide({
    model,
    state: buildWaitState(input),
    questions: {
      wait: {
        type: "boolean",
        instructions:
          "Every merge requirement on GitHub passes for this pull request. Does its description or discussion still say to wait before merging it? Yes for: an explicit « do not merge before… », another pull request it depends on that has to be merged first, a deploy freeze, a do-not-merge, on-hold or blocked label, or a question from the author still unanswered. A request that was later lifted or answered is a no.",
      },
      reason: {
        type: "choice",
        instructions: "What is the main reason to wait before merging?",
        criteria: WAIT_CRITERIA,
      },
    },
  })
  if (result.answers.wait.probability < WAIT_THRESHOLD) return null
  const reason = WAIT_REASONS.includes(result.answers.reason.choice)
    ? result.answers.reason.choice
    : "other"
  return {
    kind: "wait",
    reason,
    pull: reason === "dependency" ? referencedPull(input) : null,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Jev's answers by hash: a PR whose words did not change is not asked again. */
const waitCache = createSwrCache<ReadinessGap | null>({
  freshMs: 7 * DAY_MS,
  maxAgeMs: 7 * DAY_MS,
})

/**
 * Asks Jev last, and only about a PR the rules found ready. The previous
 * readiness carries the hash Jev already answered for, across restarts.
 */
export async function checkWait(
  model: Experimental_DecisionModel | null,
  readiness: Readiness,
  input: WaitInput,
  previous: Readiness | null
): Promise<Readiness> {
  if (!model || !needsWaitCheck(readiness)) return readiness
  const hash = waitHash(input)
  if (previous?.waitHash === hash) {
    const gap = previous.gaps.find(({ kind }) => kind === "wait") ?? null
    return withWait(readiness, { gap, hash })
  }
  try {
    const gap = await waitCache.get(hash, () => askWait(model, input))
    return withWait(readiness, { gap, hash })
  } catch (error) {
    // Without Jev, the rules alone decide.
    console.error(`[readiness] #${input.number}`, error)
    return readiness
  }
}
