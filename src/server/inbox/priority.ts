export type PriorityReason = {
  label: string
  weight: number
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

/** Jev urgency levels, in the order of the score rubric. */
export const URGENCY_LEVELS = [
  "Peut attendre",
  "Normale",
  "Importante",
  "Bloquante ou urgente",
] as const

/** Below this Jev confidence, the AI signal is ignored and flagged for review. */
export const MIN_AI_CONFIDENCE = 0.5

export function computePriority(
  input: PriorityInput,
  now: Date = new Date()
): PriorityResult {
  const reasons: PriorityReason[] = []
  const add = (label: string, weight: number) => reasons.push({ label, weight })

  if (input.state && input.state !== "OPEN") {
    return {
      priority: 0,
      reasons: [{ label: "Fermée", weight: 0 }],
      needsCheck: false,
    }
  }

  if (input.reviewRequest === "direct") add("Review demandée à toi", 30)
  if (input.reviewRequest === "team") add("Review demandée à ton équipe", 15)
  if (
    input.reviewRequest &&
    input.approvals > 0 &&
    input.pendingReviewers <= 1
  ) {
    add("Il ne manque que ta review", 15)
  }

  if (input.awaitingMe) add("On attend ta réponse", 25)
  if ((input.aiQuestionProbability ?? 0) >= 0.7) add("Question posée", 10)

  if (input.view === "mine") {
    if (input.reviewDecision === "CHANGES_REQUESTED")
      add("Changements demandés", 15)
    if (input.reviewDecision === "APPROVED")
      add("Approuvée, prête à merger", 10)
  }

  if (input.labels.some((label) => URGENT_LABEL.test(label)))
    add("Label urgent", 20)

  if (input.waitingSince) {
    const days = Math.floor(
      (now.getTime() - input.waitingSince.getTime()) / DAY_MS
    )
    if (days >= 1) add(`En attente depuis ${days} j`, Math.min(20, days * 4))
  }

  if (input.kind === "PullRequest" && input.additions !== null) {
    const size = input.additions + (input.deletions ?? 0)
    if (size <= 100) add("Petite PR", 10)
    else if (size > 1000) add("Très grosse PR", -5)
  }

  if (input.ciState === "FAILURE" || input.ciState === "ERROR") {
    add("CI en échec", input.view === "mine" ? 15 : -10)
  }
  if (input.isDraft) add("Brouillon", -20)

  let needsCheck = false
  if (input.aiUrgency !== null) {
    if ((input.aiConfidence ?? 1) >= MIN_AI_CONFIDENCE) {
      const level = URGENCY_LEVELS[Math.round(input.aiUrgency)]
      add(`IA : ${level.toLowerCase()}`, Math.round(input.aiUrgency * 10))
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
