import type { Item } from "@/server/db/schema"
import { pullSize } from "@/lib/format"
import type { PullSize } from "@/lib/format"
import { hasNewCommitsSinceReview } from "@/server/inbox/priority"
import type { Language } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"
import type { Messages } from "@/lib/i18n/messages"

export type ActionKind =
  "review" | "rereview" | "fixes" | "reply" | "ci" | "changes" | "merge"

export type NextAction = {
  kind: ActionKind
  /** Who is waiting for a reply, named in the label. */
  from?: string | null
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
        ? { kind: "fixes", minutes }
        : { kind: "rereview", minutes }
    }
    return { kind: "review", minutes: full }
  }
  // Someone waiting for an answer comes first, on the viewer's own PRs too.
  if (item.view === "awaiting" || (item.view === "mine" && item.awaitingMe))
    return { kind: "reply", from: item.awaitingFrom, minutes: 5 }
  if (item.view === "mine") {
    if (item.ciState === "FAILURE" || item.ciState === "ERROR")
      return { kind: "ci", minutes: 15 }
    if (item.reviewDecision === "CHANGES_REQUESTED")
      return { kind: "changes", minutes: 20 }
    if (item.reviewDecision === "APPROVED") return { kind: "merge", minutes: 2 }
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

/** What to do, as a verb phrase: "Répondre à @dev". */
export function actionLabel(
  action: Pick<NextAction, "kind" | "from">,
  t: Messages
): string {
  const labels = t.dashboard.actions
  if (action.kind === "reply" && action.from) return labels.replyTo(action.from)
  return labels[action.kind]
}

/** "≈ 2 h 10", "≈ 45 min" or "0 min". */
export function formatMinutes(minutes: number, language: Language): string {
  const { duration } = messagesFor(language).dashboard
  if (minutes === 0) return duration.minutes(0)
  // Estimates are rough: rounded to 5 minutes.
  const rounded = Math.max(5, Math.round(minutes / 5) * 5)
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return duration.approx(duration.minutes(rest))
  return duration.approx(
    rest
      ? duration.hoursMinutes(hours, String(rest).padStart(2, "0"))
      : duration.hours(String(hours))
  )
}
