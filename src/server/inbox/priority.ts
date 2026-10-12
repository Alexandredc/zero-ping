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

export const NEEDS_CHECK_HINT =
  "Jev a répondu avec une confiance trop faible (moins de 50 %) : son estimation n'est pas comptée dans le score. Regarde toi-même si c'est urgent."

/** Below this Jev confidence, the AI signal is ignored and flagged for review. */
export const MIN_AI_CONFIDENCE = 0.5

function formatConfidence(confidence: number | null): string {
  return confidence === null
    ? "non fournie"
    : `${Math.round(confidence * 100)} %`
}

export function computePriority(
  input: PriorityInput,
  now: Date = new Date()
): PriorityResult {
  const reasons: PriorityReason[] = []
  const add = (label: string, weight: number, hint: string) =>
    reasons.push({ label, weight, hint })

  if (input.state && input.state !== "OPEN") {
    return {
      priority: 0,
      reasons: [
        {
          label: "Fermée",
          weight: 0,
          hint: "Mergée ou fermée : rien à faire.",
        },
      ],
      needsCheck: false,
    }
  }

  if (input.reviewRequest === "direct")
    add(
      "Review demandée à toi",
      30,
      "Tu es nommé personnellement comme reviewer."
    )
  if (input.reviewRequest === "team")
    add(
      "Review demandée à ton équipe",
      15,
      "La demande vise une de tes équipes : un collègue peut aussi la prendre."
    )
  if (
    input.reviewRequest &&
    input.approvals > 0 &&
    input.pendingReviewers <= 1
  ) {
    add(
      "Il ne manque que ta review",
      15,
      "La PR a déjà au moins une approbation et tu es le dernier reviewer attendu."
    )
  }

  if (input.awaitingMe)
    add(
      "On attend ta réponse",
      25,
      "Quelqu'un t'a mentionné ou a répondu après toi dans un fil, et tu n'as pas encore réagi."
    )
  if ((input.aiQuestionProbability ?? 0) >= 0.7)
    add(
      "Question posée",
      10,
      "Jev estime que le message t'adresse une vraie question ou une décision à prendre."
    )

  if (input.view === "mine") {
    if (input.reviewDecision === "CHANGES_REQUESTED")
      add(
        "Changements demandés",
        15,
        "Un reviewer a demandé des changements sur ta PR."
      )
    if (input.reviewDecision === "APPROVED")
      add(
        "Approuvée, prête à merger",
        10,
        "Ta PR est approuvée : il ne reste qu'à la merger."
      )
  }

  if (input.labels.some((label) => URGENT_LABEL.test(label)))
    add(
      "Label urgent",
      20,
      "Un label signale l'urgence (urgent, hotfix, blocking, critical, p0…)."
    )

  if (input.waitingSince) {
    const days = Math.floor(
      (now.getTime() - input.waitingSince.getTime()) / DAY_MS
    )
    if (days >= 1)
      add(
        `En attente depuis ${days} j`,
        Math.min(20, days * 4),
        "Depuis la demande de review ou le message sans réponse : 4 points par jour, 20 au maximum."
      )
  }

  if (input.kind === "PullRequest" && input.additions !== null) {
    const size = input.additions + (input.deletions ?? 0)
    if (size <= 100)
      add(
        "Petite PR",
        10,
        "100 lignes modifiées ou moins : rapide à reviewer pour débloquer quelqu'un."
      )
    else if (size > 1000)
      add(
        "Très grosse PR",
        -5,
        "Plus de 1 000 lignes modifiées : à planifier plutôt qu'à glisser entre deux tâches."
      )
  }

  if (input.ciState === "FAILURE" || input.ciState === "ERROR") {
    add(
      "CI en échec",
      input.view === "mine" ? 15 : -10,
      input.view === "mine"
        ? "La CI de ta PR échoue : c'est à toi de la corriger."
        : "La CI échoue : l'auteur devra sans doute modifier la PR avant ta review."
    )
  }
  if (input.isDraft)
    add(
      "Brouillon",
      -20,
      "La PR est en brouillon : l'auteur ne la considère pas encore prête."
    )

  let needsCheck = false
  if (input.aiUrgency !== null) {
    if ((input.aiConfidence ?? 1) >= MIN_AI_CONFIDENCE) {
      const level = URGENCY_LEVELS[Math.round(input.aiUrgency)]
      add(
        `IA : ${level.toLowerCase()}`,
        Math.round(input.aiUrgency * 10),
        `Urgence estimée par Jev à partir du titre, de la description, des labels et des derniers commentaires (confiance ${formatConfidence(input.aiConfidence)}).`
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
