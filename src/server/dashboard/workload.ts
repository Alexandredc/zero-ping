import type { Item } from "@/server/db/schema"
import { pullSize } from "@/lib/format"
import type { PullSize } from "@/lib/format"
import { hasNewCommitsSinceReview } from "@/server/inbox/priority"

export type ActionKind =
  "review" | "rereview" | "fixes" | "reply" | "ci" | "changes" | "merge"

export type NextAction = {
  kind: ActionKind
  /** What to do, as a verb phrase. */
  label: string
  minutes: number
}

/** Rough reading time of a review by PR size, in minutes. */
const REVIEW_MINUTES: Record<PullSize, number> = {
  XS: 5,
  S: 10,
  M: 20,
  L: 40,
  XL: 60,
}
const UNKNOWN_SIZE_MINUTES = 15

type ActionInput = Pick<
  Item,
  | "view"
  | "kind"
  | "additions"
  | "deletions"
  | "headOid"
  | "reviewedOid"
  | "reviewedState"
  | "reviewRequest"
  | "awaitingFrom"
  | "awaitingMe"
  | "ciState"
  | "reviewDecision"
>

/**
 * The next thing to do on an item and how long it should take, or null when
 * the ball is in someone else's court.
 */
export function nextAction(item: ActionInput): NextAction | null {
  if (item.view === "review") {
    const full =
      item.additions === null
        ? UNKNOWN_SIZE_MINUTES
        : REVIEW_MINUTES[pullSize(item.additions, item.deletions)]
    if (hasNewCommitsSinceReview(item)) {
      // Only the commits since the last review are left to read.
      const minutes = Math.max(5, Math.round(full / 2))
      return item.reviewedState === "CHANGES_REQUESTED" && !item.reviewRequest
        ? { kind: "fixes", label: "Vérifier les corrections", minutes }
        : { kind: "rereview", label: "Re-reviewer", minutes }
    }
    return { kind: "review", label: "Reviewer", minutes: full }
  }
  // Someone waiting for an answer comes first, on the viewer's own PRs too.
  if (item.view === "awaiting" || (item.view === "mine" && item.awaitingMe))
    return {
      kind: "reply",
      label: item.awaitingFrom
        ? `Répondre à @${item.awaitingFrom}`
        : "Répondre",
      minutes: 5,
    }
  if (item.view === "mine") {
    if (item.ciState === "FAILURE" || item.ciState === "ERROR")
      return { kind: "ci", label: "Réparer la CI", minutes: 15 }
    if (item.reviewDecision === "CHANGES_REQUESTED")
      return { kind: "changes", label: "Traiter les retours", minutes: 20 }
    if (item.reviewDecision === "APPROVED")
      return { kind: "merge", label: "Merger", minutes: 2 }
  }
  return null
}

export type Workload = {
  totalMinutes: number
  byView: { review: number; awaiting: number; mine: number }
  actions: (NextAction & { item: Item })[]
}

/** Sums the estimates of active items, given in priority order. */
export function summarizeWorkload(items: Item[], limit = 6): Workload {
  const byView = { review: 0, awaiting: 0, mine: 0 }
  const actions: Workload["actions"] = []
  for (const item of items) {
    const action = nextAction(item)
    if (!action) continue
    if (
      item.view === "review" ||
      item.view === "awaiting" ||
      item.view === "mine"
    )
      byView[item.view] += action.minutes
    actions.push({ ...action, item })
  }
  return {
    totalMinutes: byView.review + byView.awaiting + byView.mine,
    byView,
    actions: actions.slice(0, limit),
  }
}

/** "≈ 2 h 10", "≈ 45 min" or "0 min". */
export function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0 min"
  // Estimates are rough: rounded to 5 minutes.
  const rounded = Math.max(5, Math.round(minutes / 5) * 5)
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return `≈ ${rest} min`
  return `≈ ${hours} h${rest ? ` ${String(rest).padStart(2, "0")}` : ""}`
}
