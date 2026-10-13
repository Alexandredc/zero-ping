import type { Messages } from "@/lib/i18n/messages"

export type PriorityReason = {
  label: string
  weight: number
  /** Explains the rule in the interface; absent on rows scored before it existed. */
  hint?: string
}

export type PriorityInput = {
  kind: "PullRequest" | "Issue" | "Discussion" | "Other"
  view: "review" | "awaiting" | "mine" | "other"
  isDraft: boolean
  state: string | null
  labels: string[]
  additions: number | null
  deletions: number | null
  ciState: string | null
  reviewDecision: string | null
  reviewRequest: "direct" | "team" | null
  approvals: number
  pendingReviewers: number
  headOid: string | null
  reviewedOid: string | null
  reviewedState: string | null
  awaitingMe: boolean
  waitingSince: Date | null
  aiUrgency: number | null
  aiConfidence: number | null
  aiQuestionProbability: number | null
}

export type PriorityResult = {
  priority: number
  reasons: PriorityReason[]
  needsCheck: boolean
}

const URGENT_LABEL =
  /\b(urgent|hotfix|blocking|blocker|critical|p0|sev[ -]?[01])\b/i
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Jev urgency levels, in the order of the score rubric. They stay the rubric Jev
 * scores against whatever the language; `t.server.priority.urgencyLevels` shows them.
 */
export const URGENCY_LEVELS = [
  "Peut attendre",
  "Normale",
  "Importante",
  "Bloquante ou urgente",
] as const

/** Below this Jev confidence, the AI signal is ignored and flagged for review. */
export const MIN_AI_CONFIDENCE = 0.5

function formatConfidence(confidence: number | null, t: Messages): string {
  return confidence === null
    ? t.server.priority.confidenceMissing
    : t.server.priority.confidence(Math.round(confidence * 100))
}

/** The viewer reviewed the PR and its head moved since. */
export function hasNewCommitsSinceReview(
  input: Pick<PriorityInput, "headOid" | "reviewedOid">
): boolean {
  return (
    input.reviewedOid !== null &&
    input.headOid !== null &&
    input.reviewedOid !== input.headOid
  )
}

/** `t` writes the reasons: they are stored with the item and shown as they are. */
export function computePriority(
  input: PriorityInput,
  t: Messages,
  now: Date = new Date()
): PriorityResult {
  const m = t.server.priority
  const reasons: PriorityReason[] = []
  const add = (label: string, weight: number, hint: string) =>
    reasons.push({ label, weight, hint })

  if (input.state && input.state !== "OPEN") {
    return {
      priority: 0,
      reasons: [
        {
          label: m.closed,
          weight: 0,
          hint: m.closedHint,
        },
      ],
      needsCheck: false,
    }
  }

  if (input.reviewRequest === "direct")
    add(m.reviewDirect, 30, m.reviewDirectHint)
  if (input.reviewRequest === "team") add(m.reviewTeam, 15, m.reviewTeamHint)
  if (
    input.reviewRequest &&
    input.approvals > 0 &&
    input.pendingReviewers <= 1
  ) {
    add(m.lastReviewer, 15, m.lastReviewerHint)
  }

  if (hasNewCommitsSinceReview(input)) {
    if (input.reviewedState === "CHANGES_REQUESTED" && !input.reviewRequest)
      add(m.fixesPushed, 25, m.fixesPushedHint)
    else if (input.reviewRequest) add(m.reReview, 5, m.reReviewHint)
  }

  if (input.awaitingMe) add(m.awaiting, 25, m.awaitingHint)
  if ((input.aiQuestionProbability ?? 0) >= 0.7)
    add(m.question, 10, m.questionHint)

  if (input.view === "mine") {
    if (input.reviewDecision === "CHANGES_REQUESTED")
      add(m.changesRequested, 15, m.changesRequestedHint)
    if (input.reviewDecision === "APPROVED") add(m.approved, 10, m.approvedHint)
  }

  if (input.labels.some((label) => URGENT_LABEL.test(label)))
    add(m.urgentLabel, 20, m.urgentLabelHint)

  if (input.waitingSince) {
    const days = Math.floor(
      (now.getTime() - input.waitingSince.getTime()) / DAY_MS
    )
    if (days >= 1) add(m.waiting(days), Math.min(20, days * 4), m.waitingHint)
  }

  if (input.kind === "PullRequest" && input.additions !== null) {
    const size = input.additions + (input.deletions ?? 0)
    if (size <= 100) add(m.smallPull, 10, m.smallPullHint)
    else if (size > 1000) add(m.hugePull, -5, m.hugePullHint)
  }

  if (input.ciState === "FAILURE" || input.ciState === "ERROR") {
    add(
      m.ciFailing,
      input.view === "mine" ? 15 : -10,
      input.view === "mine" ? m.ciFailingMineHint : m.ciFailingHint
    )
  }
  if (input.isDraft) add(m.draft, -20, m.draftHint)

  let needsCheck = false
  if (input.aiUrgency !== null) {
    if ((input.aiConfidence ?? 1) >= MIN_AI_CONFIDENCE) {
      add(
        m.ai(m.urgencyLevels[Math.round(input.aiUrgency)]),
        Math.round(input.aiUrgency * 10),
        m.aiHintWithConfidence(formatConfidence(input.aiConfidence, t))
      )
    } else {
      needsCheck = true
    }
  }

  const total = reasons.reduce((sum, reason) => sum + reason.weight, 0)
  return {
    priority: Math.max(0, Math.min(100, total)),
    reasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    needsCheck,
  }
}
