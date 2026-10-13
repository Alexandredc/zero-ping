import type {
  ChatMessage,
  NewItem,
  PullInsight,
  SlackDiscussion,
  SummaryContent,
  SummaryLength,
  TeamProblem,
} from "@/server/db/schema"
import type {
  Conversation,
  ConversationEntry,
} from "@/server/github/conversation"
import type { PullChecks } from "@/server/github/checks"
import type { MergeInfo } from "@/server/github/merge"
import type { PullFile } from "@/server/github/pull-files"
import type { ReviewerOptions } from "@/server/github/reviewers"
import type { UatStatus } from "@/server/github/uat"
import type { Sprint, SprintStatus, WorkItem } from "@/server/issues/sprint"
import type { WeekEntry, WeekSummary } from "@/server/recap/week"
import { weekStart } from "@/server/recap/week"
import type { StandupState } from "@/server/recap/standup"
import { DEMO_VIEWER } from "./mode"

/**
 * The demo's fictional world: the Acme team, its repositories, PRs, issues,
 * Slack threads and AI output. Every date is relative to `now`, so the demo
 * always looks like a fresh morning.
 */

export const DEMO_PEOPLE = [
  { login: DEMO_VIEWER.login, name: "Jane Doe" },
  { login: "alex-martin", name: "Alex Martin" },
  { login: "sam-lee", name: "Sam Lee" },
  { login: "priya-shah", name: "Priya Shah" },
  { login: "tom-becker", name: "Tom Becker" },
  { login: "nina-rossi", name: "Nina Rossi" },
] as const

export const DEMO_REPOS = ["acme/api", "acme/web", "acme/infra"] as const

const ME = DEMO_VIEWER.login
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const nameOf = (login: string | null) =>
  DEMO_PEOPLE.find((person) => person.login === login)?.name ?? login

const pullUrl = (repo: string, number: number) =>
  `https://github.com/${repo}/pull/${number}`
const issueUrl = (repo: string, number: number) =>
  `https://github.com/${repo}/issues/${number}`
const slackLink = (channel: string, ts: number) =>
  `https://acme.slack.com/archives/${channel}/p${ts}000000`

/** One inbox item, before the seed computes its priority. */
type DemoItem = Omit<NewItem, "priority" | "priorityReasons" | "needsCheck">

export type DemoPull = {
  /** `owner/repo#number`. */
  key: string
  conversation?: () => Conversation
  files?: PullFile[]
  checks?: PullChecks
  uat?: UatStatus | null
  project?: { status: string; priority: string | null; via?: number }
  linkedIssues?: { number: number; title: string; assignees: string[] }[]
}

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms)

export function demoItems(now: Date): DemoItem[] {
  const base = {
    unread: false,
    state: "OPEN",
    isDraft: false,
    labels: [] as string[],
    approvals: 0,
    pendingReviewers: 0,
    enrichedAt: now,
    aiConfidence: 0.85,
    aiQuestionProbability: 0.1,
  }
  const pull = (repo: string, number: number) => ({
    key: `${repo}#${number}`,
    repoFullName: repo,
    number,
    kind: "PullRequest" as const,
    subjectType: "PullRequest",
    htmlUrl: pullUrl(repo, number),
    threadId: null,
  })
  const issue = (repo: string, number: number) => ({
    key: `${repo}#${number}`,
    repoFullName: repo,
    number,
    kind: "Issue" as const,
    subjectType: "Issue",
    htmlUrl: issueUrl(repo, number),
    threadId: null,
  })
  return [
    // « À reviewer »
    {
      ...base,
      ...pull("acme/api", 412),
      title: "feat: rate limiting for the public API",
      reason: "review_requested",
      view: "review",
      unread: true,
      updatedAt: ago(now, 2 * HOUR_MS),
      author: "alex-martin",
      labels: ["enhancement", "api"],
      additions: 386,
      deletions: 74,
      changedFiles: 9,
      ciState: "SUCCESS",
      reviewDecision: "REVIEW_REQUIRED",
      reviewRequest: "direct",
      approvals: 1,
      pendingReviewers: 1,
      requestedAt: ago(now, 28 * HOUR_MS),
      headOid: "a41c9e2",
      aiUrgency: 2.3,
      aiConfidence: 0.82,
    },
    {
      ...base,
      ...pull("acme/web", 238),
      title: "fix: checkout button stays disabled on Safari",
      reason: "review_requested",
      view: "review",
      unread: true,
      updatedAt: ago(now, 40 * 60_000),
      author: "priya-shah",
      labels: ["bug", "urgent"],
      additions: 14,
      deletions: 5,
      changedFiles: 2,
      ciState: "SUCCESS",
      reviewDecision: "REVIEW_REQUIRED",
      reviewRequest: "direct",
      pendingReviewers: 1,
      requestedAt: ago(now, 3 * HOUR_MS),
      headOid: "77d0b13",
      aiUrgency: 2.9,
      aiConfidence: 0.91,
    },
    {
      ...base,
      ...pull("acme/web", 231),
      title: "Dark mode for the settings page",
      reason: "review_requested",
      view: "review",
      updatedAt: ago(now, 5 * HOUR_MS),
      author: "nina-rossi",
      labels: ["ui"],
      additions: 212,
      deletions: 48,
      changedFiles: 7,
      ciState: "SUCCESS",
      reviewDecision: "CHANGES_REQUESTED",
      reviewRequest: "direct",
      pendingReviewers: 1,
      requestedAt: ago(now, 3 * DAY_MS),
      headOid: "c3f81aa",
      reviewedOid: "9be2d40",
      reviewedAt: ago(now, 2 * DAY_MS),
      reviewedState: "CHANGES_REQUESTED",
      aiUrgency: 1.4,
    },
    {
      ...base,
      ...pull("acme/api", 405),
      title: "Move invoices to the new billing service",
      reason: "team_mention",
      view: "review",
      updatedAt: ago(now, 7 * HOUR_MS),
      author: "sam-lee",
      labels: ["billing"],
      additions: 1184,
      deletions: 562,
      changedFiles: 31,
      ciState: "PENDING",
      reviewDecision: "REVIEW_REQUIRED",
      reviewRequest: "team",
      pendingReviewers: 2,
      requestedAt: ago(now, 4 * DAY_MS),
      headOid: "5e0a7c1",
      aiUrgency: 1.7,
      aiConfidence: 0.74,
    },
    {
      ...base,
      ...pull("acme/infra", 57),
      title: "chore: Postgres 17 on staging",
      reason: "review_requested",
      view: "review",
      updatedAt: ago(now, 9 * HOUR_MS),
      author: "tom-becker",
      labels: ["infra"],
      additions: 36,
      deletions: 31,
      changedFiles: 4,
      ciState: "FAILURE",
      reviewDecision: "REVIEW_REQUIRED",
      reviewRequest: "direct",
      pendingReviewers: 1,
      requestedAt: ago(now, 20 * HOUR_MS),
      headOid: "e9921fd",
      aiUrgency: 0.8,
      aiConfidence: 0.42,
    },

    // « On t'attend »
    {
      ...base,
      ...issue("acme/api", 398),
      title: "Webhook retries flood the logs",
      reason: "mention",
      view: "awaiting",
      unread: true,
      updatedAt: ago(now, 50 * 60_000),
      author: "sam-lee",
      labels: ["bug", "observability"],
      awaitingMe: true,
      awaitingUrl: `${issueUrl("acme/api", 398)}#issuecomment-1`,
      awaitingExcerpt:
        "@jane-doe ok pour plafonner à 5 tentatives avec un backoff exponentiel ? Je peux faire la PR aujourd'hui.",
      awaitingFrom: "sam-lee",
      awaitingSince: ago(now, 50 * 60_000),
      aiUrgency: 2.1,
      aiQuestionProbability: 0.95,
    },
    {
      ...base,
      ...pull("acme/web", 226),
      title: "refactor: split the cart store",
      reason: "comment",
      view: "awaiting",
      updatedAt: ago(now, 3 * HOUR_MS),
      author: "priya-shah",
      additions: 248,
      deletions: 190,
      changedFiles: 8,
      ciState: "SUCCESS",
      reviewDecision: "REVIEW_REQUIRED",
      headOid: "1d2e3f4",
      reviewedOid: "1d2e3f4",
      reviewedAt: ago(now, DAY_MS),
      reviewedState: "COMMENTED",
      awaitingMe: true,
      awaitingUrl: `${pullUrl("acme/web", 226)}#discussion_r1`,
      awaitingExcerpt:
        "Bien vu. Je sors la logique de remise dans un hook useDiscounts, ça te va ?",
      awaitingFrom: "priya-shah",
      awaitingSince: ago(now, 3 * HOUR_MS),
      aiUrgency: 1.2,
      aiQuestionProbability: 0.88,
    },

    // « Mes PR »
    {
      ...base,
      ...pull("acme/api", 415),
      title: "feat: export usage reports as CSV",
      reason: "author",
      view: "mine",
      updatedAt: ago(now, HOUR_MS),
      author: ME,
      labels: ["enhancement"],
      additions: 164,
      deletions: 12,
      changedFiles: 5,
      ciState: "SUCCESS",
      reviewDecision: "APPROVED",
      approvals: 2,
      headOid: "f00dcaf",
      aiUrgency: 1.1,
    },
    {
      ...base,
      ...pull("acme/web", 240),
      title: "chore: upgrade to React 19",
      reason: "author",
      view: "mine",
      updatedAt: ago(now, 4 * HOUR_MS),
      author: ME,
      labels: ["dependencies"],
      additions: 96,
      deletions: 88,
      changedFiles: 14,
      ciState: "FAILURE",
      reviewDecision: "REVIEW_REQUIRED",
      pendingReviewers: 2,
      headOid: "b0b0b0b",
      aiUrgency: 1.5,
    },
    {
      ...base,
      ...pull("acme/api", 409),
      title: "feat: OpenTelemetry tracing for background jobs",
      reason: "author",
      view: "mine",
      isDraft: true,
      updatedAt: ago(now, 2 * DAY_MS),
      author: ME,
      additions: 310,
      deletions: 22,
      changedFiles: 11,
      ciState: "SUCCESS",
      reviewDecision: null,
      headOid: "0ace0fb",
      aiUrgency: 0.6,
    },

    // « Autres »
    {
      ...base,
      ...issue("acme/web", 244),
      title: "Design review: new onboarding flow",
      reason: "subscribed",
      view: "other",
      updatedAt: ago(now, 6 * HOUR_MS),
      author: "nina-rossi",
      labels: ["design"],
      aiUrgency: 0.7,
    },

    // « En pause »
    {
      ...base,
      ...pull("acme/infra", 55),
      title: "Terraform module for the CDN",
      reason: "review_requested",
      view: "review",
      updatedAt: ago(now, 2 * DAY_MS),
      author: "tom-becker",
      additions: 420,
      deletions: 0,
      changedFiles: 6,
      ciState: "SUCCESS",
      reviewDecision: "REVIEW_REQUIRED",
      reviewRequest: "team",
      requestedAt: ago(now, 2 * DAY_MS),
      snoozedUntil: new Date(now.getTime() + 2 * DAY_MS),
      aiUrgency: 0.9,
    },

    // « Traités »
    {
      ...base,
      ...pull("acme/api", 401),
      title: "chore(deps): bump zod from 4.1.0 to 4.2.1",
      reason: "subscribed",
      view: "other",
      state: "MERGED",
      updatedAt: ago(now, 5 * HOUR_MS),
      author: "renovate[bot]",
      labels: ["dependencies"],
      doneAt: ago(now, 5 * HOUR_MS),
      autoDoneReason: "Bot",
    },
    {
      ...base,
      key: "acme/web#release-v2.14.0",
      repoFullName: "acme/web",
      number: null,
      kind: "Other",
      subjectType: "Release",
      htmlUrl: "https://github.com/acme/web/releases/tag/v2.14.0",
      threadId: null,
      title: "v2.14.0",
      reason: "subscribed",
      view: "other",
      updatedAt: ago(now, DAY_MS),
      author: "github-actions[bot]",
      doneAt: ago(now, DAY_MS),
      autoDoneReason: "Release",
    },
    {
      ...base,
      ...pull("acme/web", 229),
      title: "fix: broken avatar fallback in the header",
      reason: "review_requested",
      view: "other",
      state: "MERGED",
      updatedAt: ago(now, DAY_MS + 3 * HOUR_MS),
      author: "nina-rossi",
      additions: 8,
      deletions: 3,
      ciState: "SUCCESS",
      reviewDecision: "APPROVED",
      requestedAt: ago(now, 2 * DAY_MS),
      reviewedAt: ago(now, DAY_MS + 5 * HOUR_MS),
      reviewedState: "APPROVED",
      doneAt: ago(now, DAY_MS + 3 * HOUR_MS),
      autoDoneReason: "PR mergée",
    },
  ]
}

/** Open PRs of the tracked repos by others, as the team sync stores them. */
export function demoTeamPulls(now: Date) {
  const pull = (
    repo: string,
    number: number,
    fields: {
      title: string
      author: string
      createdDaysAgo: number
      additions: number
      deletions: number
      reviewers: string[]
      reviewDecision?: string | null
      ciState?: string | null
      mergeable?: string
      problems?: TeamProblem[]
      isDraft?: boolean
    }
  ) => ({
    key: `${repo}#${number}`,
    repoFullName: repo,
    number,
    title: fields.title,
    htmlUrl: pullUrl(repo, number),
    author: fields.author,
    isDraft: fields.isDraft ?? false,
    createdAt: ago(now, fields.createdDaysAgo * DAY_MS),
    updatedAt: ago(now, Math.min(fields.createdDaysAgo, 1) * 6 * HOUR_MS),
    additions: fields.additions,
    deletions: fields.deletions,
    reviewers: fields.reviewers,
    reviewDecision: fields.reviewDecision ?? "REVIEW_REQUIRED",
    ciState: fields.ciState ?? "SUCCESS",
    mergeable: fields.mergeable ?? "MERGEABLE",
    problems: fields.problems ?? [],
    syncedAt: now,
  })
  return [
    pull("acme/api", 412, {
      title: "feat: rate limiting for the public API",
      author: "alex-martin",
      createdDaysAgo: 2,
      additions: 386,
      deletions: 74,
      reviewers: [ME, "sam-lee"],
    }),
    pull("acme/web", 238, {
      title: "fix: checkout button stays disabled on Safari",
      author: "priya-shah",
      createdDaysAgo: 0.2,
      additions: 14,
      deletions: 5,
      reviewers: [ME],
    }),
    pull("acme/web", 231, {
      title: "Dark mode for the settings page",
      author: "nina-rossi",
      createdDaysAgo: 4,
      additions: 212,
      deletions: 48,
      reviewers: [ME],
      reviewDecision: "CHANGES_REQUESTED",
      problems: ["changes"],
    }),
    pull("acme/api", 405, {
      title: "Move invoices to the new billing service",
      author: "sam-lee",
      createdDaysAgo: 9,
      additions: 1184,
      deletions: 562,
      reviewers: ["team:backend"],
      ciState: "PENDING",
      problems: ["stale"],
    }),
    pull("acme/infra", 57, {
      title: "chore: Postgres 17 on staging",
      author: "tom-becker",
      createdDaysAgo: 1,
      additions: 36,
      deletions: 31,
      reviewers: [ME],
      ciState: "FAILURE",
      problems: ["ci"],
    }),
    pull("acme/web", 219, {
      title: "perf: lazy-load product images below the fold",
      author: "tom-becker",
      createdDaysAgo: 3,
      additions: 74,
      deletions: 21,
      reviewers: [],
      problems: ["no-reviewer"],
    }),
    pull("acme/api", 388, {
      title: "refactor: split the users controller",
      author: "alex-martin",
      createdDaysAgo: 12,
      additions: 640,
      deletions: 590,
      reviewers: ["priya-shah"],
      mergeable: "CONFLICTING",
      problems: ["conflict", "stale"],
    }),
    pull("acme/web", 242, {
      title: "docs: Storybook stories for Button and Input",
      author: "nina-rossi",
      createdDaysAgo: 1,
      additions: 130,
      deletions: 0,
      reviewers: ["priya-shah"],
      reviewDecision: "APPROVED",
    }),
    pull("acme/web", 226, {
      title: "refactor: split the cart store",
      author: "priya-shah",
      createdDaysAgo: 2,
      additions: 248,
      deletions: 190,
      reviewers: [ME],
    }),
  ]
}

/** Jev's urgency for the team PRs outside the inbox. */
export const DEMO_TEAM_SCORES: Record<string, number> = {
  "acme/web#219": 1.3,
  "acme/api#388": 0.9,
  "acme/web#242": 0.4,
}

const SLACK_TS = 1_760_000_000

export function demoSlack(now: Date): Record<string, SlackDiscussion[]> {
  const at = (ms: number) => ago(now, ms).toISOString()
  return {
    "acme/api#412": [
      {
        channel: "#api-team",
        permalink: slackLink("C01APITEAM", SLACK_TS),
        match: "link",
        messages: [
          {
            author: "Alex Martin",
            text: "PR du rate limiting prête : 100 req/min par clé, 429 avec Retry-After. https://github.com/acme/api/pull/412",
            postedAt: at(27 * HOUR_MS),
          },
          {
            author: "Sam Lee",
            text: "On garde une exception pour les clés internes du back-office ?",
            postedAt: at(26 * HOUR_MS),
          },
          {
            author: "Alex Martin",
            text: "Oui, via une allowlist en config. Jane, tu peux jeter un œil au middleware ?",
            postedAt: at(25 * HOUR_MS),
          },
        ],
      },
      {
        channel: "#support",
        permalink: slackLink("C02SUPPORT", SLACK_TS + 3600),
        match: "reference",
        messages: [
          {
            author: "Nina Rossi",
            text: "Un client a saturé l'API cette nuit avec un script de synchro. acme/api#412 devrait régler ça.",
            postedAt: at(30 * HOUR_MS),
          },
        ],
      },
    ],
    "acme/web#238": [
      {
        channel: "#incidents",
        permalink: slackLink("C03INCIDENT", SLACK_TS + 7200),
        match: "title",
        messages: [
          {
            author: "Priya Shah",
            text: "Le bouton de paiement reste grisé sur Safari 18, le fix est en review.",
            postedAt: at(3 * HOUR_MS),
          },
          {
            author: "Tom Becker",
            text: "Le taux de conversion Safari a chuté de 12 % depuis hier, on peut le passer en priorité ?",
            postedAt: at(2 * HOUR_MS),
          },
        ],
      },
    ],
    "acme/web#236": [
      {
        channel: "#incidents",
        permalink: slackLink("C03INCIDENT", SLACK_TS + 7200),
        match: "reference",
        messages: [
          {
            author: "Tom Becker",
            text: "Le taux de conversion Safari a chuté de 12 % depuis hier, acme/web#236 passe en P0.",
            postedAt: at(2 * HOUR_MS),
          },
          {
            author: "Priya Shah",
            text: "Fix en review dans acme/web#238, Jane est dessus.",
            postedAt: at(90 * 60_000),
          },
        ],
      },
    ],
    "acme/api#398": [
      {
        channel: "#api-team",
        permalink: slackLink("C01APITEAM", SLACK_TS + 10800),
        match: "reference",
        messages: [
          {
            author: "Sam Lee",
            text: "acme/api#398 : 40 000 lignes de logs par heure à cause des retries de webhooks.",
            postedAt: at(5 * HOUR_MS),
          },
        ],
      },
    ],
    "acme/api#415": [
      {
        channel: "#pull-requests",
        permalink: slackLink("C04PULLREQ", SLACK_TS + 14400),
        match: "link",
        messages: [
          {
            author: "Jane Doe",
            text: "Export CSV des rapports d'usage : https://github.com/acme/api/pull/415",
            postedAt: at(DAY_MS),
          },
          {
            author: "Alex Martin",
            text: "Approuvée ✅",
            postedAt: at(2 * HOUR_MS),
          },
        ],
      },
    ],
  }
}

type Summaries = Partial<Record<SummaryLength, SummaryContent>>

export function demoSummaries(): Record<string, Summaries> {
  return {
    "acme/api#412": {
      short: {
        tldr: "Ajoute un rate limiting de 100 requêtes par minute et par clé d'API, avec une allowlist pour les clés internes.",
        status: "Approuvée par Sam, CI verte ; il ne manque que ta review.",
        expectedFromMe: "Relire le middleware et l'allowlist.",
        openQuestions: [],
        risks: ["Compteur en mémoire, pas partagé entre instances"],
      },
      standard: {
        tldr: "Ajoute un rate limiting de 100 requêtes par minute et par clé d'API sur l'API publique.",
        status:
          "Approuvée par Sam, CI verte. Il manque ta review, demandée hier par Alex sur Slack.",
        expectedFromMe:
          "Relire le middleware et la gestion de l'allowlist des clés internes.",
        openQuestions: ["La limite doit-elle être réglable par client ?"],
        risks: [
          "Le compteur vit en mémoire : il ne tient pas à plusieurs instances.",
        ],
      },
      detailed: {
        tldr: "Ajoute un rate limiting de 100 requêtes par minute et par clé d'API sur l'API publique, avec une réponse 429 et un en-tête Retry-After. Fait suite à la saturation de cette nuit signalée dans #support.",
        status:
          "Approuvée par Sam, CI verte, 9 fichiers modifiés. Alex a demandé ta review hier dans #api-team ; aucune discussion ouverte sur GitHub.",
        expectedFromMe:
          "Une review du middleware `rateLimit` et de l'allowlist des clés internes du back-office, puis une approbation si tout va bien.",
        openQuestions: [
          "La limite doit-elle être réglable par client (plan entreprise) ?",
          "Faut-il journaliser les clés bloquées pour le support ?",
        ],
        risks: [
          "Le compteur vit en mémoire : avec plusieurs instances, la limite réelle est multipliée.",
          "L'allowlist est lue au démarrage : un changement demande un redéploiement.",
        ],
      },
    },
    "acme/web#238": {
      short: {
        tldr: "Corrige le bouton de paiement grisé sur Safari 18 (un `:has()` mal supporté) ; urgent, la conversion Safari a chuté de 12 %.",
        status:
          "CI verte, signalé dans #incidents ; ta review est la seule attendue.",
        expectedFromMe: "Une review rapide : 19 lignes.",
        openQuestions: [],
        risks: [],
      },
    },
    "acme/api#398": {
      short: {
        tldr: "Les retries de webhooks inondent les logs ; Sam propose de plafonner à 5 tentatives avec backoff et attend ton accord.",
        status:
          "Environ 40 000 lignes de logs par heure ; Sam est prêt à faire la PR.",
        expectedFromMe: "Valider le plafond de 5 tentatives.",
        openQuestions: ["Garder la stack complète au dernier échec ?"],
        risks: [],
      },
    },
  }
}

export function demoChats(now: Date): Record<string, ChatMessage[]> {
  return {
    "acme/api#412": [
      {
        role: "user",
        content: "Est-ce que ça casse les intégrations existantes ?",
        at: ago(now, 20 * 60_000).toISOString(),
      },
      {
        role: "assistant",
        content:
          "Non pour un usage normal : la limite (100 requêtes/min) est au-dessus du trafic moyen des clients. Les scripts de synchronisation en rafale recevront des **429** avec `Retry-After` ; le SDK officiel les réessaie déjà. Les clés internes du back-office sont dans l'allowlist.",
        at: ago(now, 19 * 60_000).toISOString(),
      },
    ],
  }
}

const insight = (
  id: string,
  level: number,
  value: number,
  confidence = 0.8
): PullInsight => ({ id, level, value, confidence })

export const DEMO_INSIGHTS: Record<string, PullInsight[]> = {
  "acme/api#412": [
    insight("risk", 1, 1.3, 0.78),
    insight("effort", 2, 1.8, 0.81),
    insight("ready", 1, 0.84, 0.86),
    insight("tests", 2, 1.7, 0.83),
    insight("breaking", 0, 0.12, 0.8),
    insight("clarity", 2, 1.9, 0.9),
    insight("security", 1, 0.71, 0.74),
    insight("data", 0, 0.08, 0.88),
    insight("infra", 0, 0.22, 0.7),
  ],
  "acme/web#238": [
    insight("risk", 0, 0.3, 0.88),
    insight("effort", 0, 0.1, 0.92),
    insight("ready", 1, 0.93, 0.9),
    insight("tests", 1, 1.0, 0.7),
    insight("breaking", 0, 0.03, 0.9),
    insight("clarity", 2, 1.8, 0.85),
    insight("security", 0, 0.02, 0.9),
    insight("data", 0, 0.02, 0.9),
    insight("infra", 0, 0.05, 0.9),
  ],
  "acme/api#398": [
    insight("ready", 1, 0.8, 0.8),
    insight("size", 0, 0.4, 0.75),
    insight("impact", 2, 1.9, 0.8),
    insight("blocked", 1, 0.7, 0.72),
    insight("split", 0, 0.1, 0.8),
    insight("techRisk", 0, 0.5, 0.7),
    insight("decision", 1, 0.92, 0.88),
  ],
}

const comment = (
  id: string,
  author: string,
  body: string,
  createdAt: Date,
  url: string
) => ({
  id,
  databaseId: null,
  author,
  authorAvatar: null,
  body,
  createdAt: createdAt.toISOString(),
  url,
})

function conversationOf(
  item: { key: string; title: string; htmlUrl: string; kind: string },
  description: { author: string; body: string; createdAt: Date },
  entries: ConversationEntry[],
  branches: { head: string; base: string } | null
): Conversation {
  return {
    kind: item.kind === "Issue" ? "Issue" : "PullRequest",
    title: item.title,
    url: item.htmlUrl,
    state: "OPEN",
    description: comment(
      `${item.key}:body`,
      description.author,
      description.body,
      description.createdAt,
      item.htmlUrl
    ),
    entries,
    branches,
  }
}

const RATE_LIMIT_PATCH = `@@ -0,0 +1,38 @@
+import type { Request, Response, NextFunction } from "express"
+import { config } from "../config"
+
+const WINDOW_MS = 60_000
+
+type Bucket = { count: number; resetAt: number }
+const buckets = new Map<string, Bucket>()
+
+/** 100 requests a minute per API key; internal keys skip the limit. */
+export function rateLimit(req: Request, res: Response, next: NextFunction) {
+  const key = req.header("x-api-key")
+  if (!key || config.rateLimit.allowlist.includes(key)) return next()
+
+  const now = Date.now()
+  const bucket = buckets.get(key)
+  if (!bucket || bucket.resetAt <= now) {
+    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
+    return next()
+  }
+
+  bucket.count += 1
+  if (bucket.count > config.rateLimit.perMinute) {
+    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
+    res.setHeader("Retry-After", String(retryAfter))
+    return res.status(429).json({
+      error: "rate_limited",
+      message: \`Too many requests, retry in \${retryAfter}s.\`,
+    })
+  }
+  next()
+}
+
+/** Forgets expired buckets so the map does not grow forever. */
+export function sweepBuckets(now = Date.now()) {
+  for (const [key, bucket] of buckets) {
+    if (bucket.resetAt <= now) buckets.delete(key)
+  }
+}`

const ROUTER_PATCH = `@@ -1,12 +1,14 @@
 import express from "express"
 import { authenticate } from "./middleware/authenticate"
+import { rateLimit } from "./middleware/rate-limit"
 import { invoicesRouter } from "./routes/invoices"
 import { usageRouter } from "./routes/usage"
 import { webhooksRouter } from "./routes/webhooks"

 export const api = express.Router()

-api.use(authenticate)
+api.use(authenticate, rateLimit)

 api.use("/invoices", invoicesRouter)
 api.use("/usage", usageRouter)
 api.use("/webhooks", webhooksRouter)
+api.get("/health", (_req, res) => res.json({ ok: true }))`

const CONFIG_PATCH = `@@ -14,6 +14,13 @@ export const config = {
   database: {
     url: env("DATABASE_URL"),
   },
+  rateLimit: {
+    perMinute: Number(env("RATE_LIMIT_PER_MINUTE", "100")),
+    /** Back-office keys, never limited. */
+    allowlist: env("RATE_LIMIT_ALLOWLIST", "")
+      .split(",")
+      .filter(Boolean),
+  },
   webhooks: {
     maxRetries: 8,
   },`

const TEST_PATCH = `@@ -0,0 +1,30 @@
+import { describe, expect, it } from "vitest"
+import request from "supertest"
+import { app } from "../app"
+
+describe("rate limiting", () => {
+  it("answers 429 with Retry-After past the limit", async () => {
+    for (let i = 0; i < 100; i++) {
+      await request(app).get("/usage").set("x-api-key", "client-key")
+    }
+    const res = await request(app).get("/usage").set("x-api-key", "client-key")
+    expect(res.status).toBe(429)
+    expect(res.headers["retry-after"]).toBeDefined()
+  })
+
+  it("never limits an allowlisted key", async () => {
+    for (let i = 0; i < 150; i++) {
+      const res = await request(app)
+        .get("/usage")
+        .set("x-api-key", "backoffice-key")
+      expect(res.status).toBe(200)
+    }
+  })
+})`

const file = (
  repo: string,
  number: number,
  filename: string,
  patch: string,
  status = "modified",
  viewed: PullFile["viewed"] = "UNVIEWED"
): PullFile => {
  const lines = patch.split("\n")
  return {
    filename,
    previousFilename: null,
    status,
    additions: lines.filter((line) => line.startsWith("+")).length,
    deletions: lines.filter((line) => line.startsWith("-")).length,
    patch,
    url: `${pullUrl(repo, number)}/files`,
    viewed,
  }
}

const checks = (
  passed: number,
  failed: PullChecks["failed"] = [],
  pending: string[] = []
): PullChecks => ({
  headSha: "a41c9e2",
  summary: {
    passed,
    failed: failed.length,
    pending: pending.length,
    skipped: 1,
    running: pending,
  },
  failed,
  rerunnableRuns: failed.flatMap((check) => (check.runId ? [check.runId] : [])),
})

/** What the detail panel reads from GitHub for the demo's subjects. */
export function demoPulls(now: Date): DemoPull[] {
  const conversation =
    (
      key: string,
      description: { author: string; body: string; daysAgo: number },
      entries: () => ConversationEntry[],
      branches: { head: string; base: string } | null = null
    ) =>
    () => {
      const item = demoItems(now).find((candidate) => candidate.key === key)!
      return conversationOf(
        item,
        {
          author: description.author,
          body: description.body,
          createdAt: ago(now, description.daysAgo * DAY_MS),
        },
        entries(),
        branches
      )
    }
  return [
    {
      key: "acme/api#412",
      conversation: conversation(
        "acme/api#412",
        {
          author: "alex-martin",
          daysAgo: 2,
          body: "## Pourquoi\n\nUn client a saturé l'API publique cette nuit avec un script de synchronisation.\n\n## Quoi\n\n- Middleware `rateLimit` : 100 requêtes par minute et par clé d'API.\n- Réponse **429** avec l'en-tête `Retry-After`.\n- Allowlist des clés internes (`RATE_LIMIT_ALLOWLIST`).\n\nCloses #397",
        },
        () => [
          {
            type: "review",
            state: "APPROVED",
            ...comment(
              "r1",
              "sam-lee",
              "Clair et bien testé. Un point à surveiller : le compteur en mémoire avec plusieurs instances.",
              ago(now, 22 * HOUR_MS),
              pullUrl("acme/api", 412)
            ),
          },
          {
            type: "thread",
            id: "t1",
            path: "src/middleware/rate-limit.ts",
            line: 7,
            isResolved: false,
            createdAt: ago(now, 21 * HOUR_MS).toISOString(),
            comments: [
              comment(
                "t1c1",
                "sam-lee",
                "On pourrait passer par Redis plus tard pour partager les compteurs entre instances.",
                ago(now, 21 * HOUR_MS),
                pullUrl("acme/api", 412)
              ),
              comment(
                "t1c2",
                "alex-martin",
                "Oui, je fais une issue de suivi : on n'a qu'une instance pour l'instant.",
                ago(now, 20 * HOUR_MS),
                pullUrl("acme/api", 412)
              ),
            ],
          },
          {
            type: "comment",
            ...comment(
              "c1",
              "alex-martin",
              "@jane-doe tu peux regarder l'allowlist ? Je veux être sûr de ne pas bloquer le back-office.",
              ago(now, 2 * HOUR_MS),
              pullUrl("acme/api", 412)
            ),
          },
        ],
        { head: "feat/rate-limiting", base: "main" }
      ),
      files: [
        file(
          "acme/api",
          412,
          "src/middleware/rate-limit.ts",
          RATE_LIMIT_PATCH,
          "added"
        ),
        file(
          "acme/api",
          412,
          "src/router.ts",
          ROUTER_PATCH,
          "modified",
          "VIEWED"
        ),
        file("acme/api", 412, "src/config.ts", CONFIG_PATCH),
        file("acme/api", 412, "test/rate-limit.test.ts", TEST_PATCH, "added"),
      ],
      checks: checks(14),
      uat: {
        state: "deployed",
        shipped: 3,
        total: 3,
        at: ago(now, 5 * HOUR_MS).toISOString(),
        outdated: [],
        missing: [],
      },
      project: { status: "In review", priority: "P1", via: 397 },
      linkedIssues: [
        {
          number: 397,
          title: "Public API has no rate limiting",
          assignees: ["alex-martin"],
        },
      ],
    },
    {
      key: "acme/web#238",
      conversation: conversation(
        "acme/web#238",
        {
          author: "priya-shah",
          daysAgo: 0.2,
          body: "Safari 18 ignore `:has()` dans ce sélecteur, le bouton reste `disabled`. Remplacé par un état React explicite.\n\nFixes #236",
        },
        () => [],
        { head: "fix/safari-checkout", base: "main" }
      ),
      checks: checks(12),
      uat: {
        state: "absent",
        shipped: 0,
        total: 2,
        at: null,
        outdated: [],
        missing: ["fix: checkout button stays disabled on Safari"],
      },
      project: { status: "In review", priority: "P0" },
    },
    {
      key: "acme/infra#57",
      checks: checks(6, [
        {
          name: "terraform plan (staging)",
          url: "https://github.com/acme/infra/actions/runs/1/job/2",
          conclusion: "failure",
          summary: 'Error: Unsupported argument "engine_version"',
          runId: 1,
        },
      ]),
      project: { status: "In progress", priority: "P2" },
    },
    {
      key: "acme/web#240",
      checks: checks(9, [
        {
          name: "e2e (chromium)",
          url: "https://github.com/acme/web/actions/runs/3/job/4",
          conclusion: "failure",
          summary: "3 tests failed in checkout.spec.ts",
          runId: 3,
        },
      ]),
      project: { status: "In progress", priority: "P2" },
    },
    {
      key: "acme/api#405",
      checks: checks(10, [], ["integration tests", "migrations dry-run"]),
      project: { status: "In review", priority: "P1" },
    },
    {
      key: "acme/api#415",
      checks: checks(14),
      uat: {
        state: "deployed",
        shipped: 2,
        total: 2,
        at: ago(now, 3 * HOUR_MS).toISOString(),
        outdated: [],
        missing: [],
      },
      project: { status: "Ready to merge", priority: "P2" },
    },
    {
      key: "acme/api#398",
      conversation: conversation(
        "acme/api#398",
        {
          author: "sam-lee",
          daysAgo: 1,
          body: "Chaque webhook en échec est réessayé 8 fois, et chaque tentative écrit la stack complète. Résultat : environ 40 000 lignes par heure.",
        },
        () => [
          {
            type: "comment",
            ...comment(
              "c398",
              "sam-lee",
              "@jane-doe ok pour plafonner à 5 tentatives avec un backoff exponentiel ? Je peux faire la PR aujourd'hui.",
              ago(now, 50 * 60_000),
              issueUrl("acme/api", 398)
            ),
          },
        ]
      ),
      project: { status: "Todo", priority: "P1" },
    },
  ]
}

/** Conversations of sprint tickets that are not inbox items. */
export function demoIssueConversations(now: Date): Map<string, Conversation> {
  const url = issueUrl("acme/web", 236)
  return new Map<string, Conversation>([
    [
      "acme/web#236",
      conversationOf(
        {
          key: "acme/web#236",
          title: "Checkout button disabled on Safari 18",
          htmlUrl: url,
          kind: "Issue",
        },
        {
          author: "tom-becker",
          body: "Depuis la mise à jour de Safari 18, le bouton **Payer** reste grisé sur la page de paiement.\n\n- Reproduit sur macOS et iOS\n- Chrome et Firefox ne sont pas touchés\n- La conversion Safari a baissé de 12 % depuis hier",
          createdAt: ago(now, DAY_MS),
        },
        [
          {
            type: "comment",
            ...comment(
              "c236",
              "priya-shah",
              "Trouvé : un sélecteur `:has()` que Safari 18 évalue mal. Le fix est dans #238.",
              ago(now, 3 * HOUR_MS),
              url
            ),
          },
        ],
        null
      ),
    ],
  ])
}

export function demoMergeInfo(title: string, head: string): MergeInfo {
  return {
    methods: ["SQUASH", "MERGE", "REBASE"],
    defaultMethod: "SQUASH",
    mergeStateStatus: "CLEAN",
    canMerge: true,
    blockedReason: null,
    headRef: head,
    autoDeletesBranch: true,
    isCrossRepository: false,
    title,
  }
}

export function demoReviewerOptions(author: string | null): ReviewerOptions {
  const others = DEMO_PEOPLE.filter((person) => person.login !== author)
  return {
    requested: [ME],
    candidates: [
      ...others.map((person, index) => ({
        id: person.login,
        label: person.login,
        name: person.name,
        kind: "user" as const,
        suggested: index < 2,
        reviewState: null,
      })),
      {
        id: "team:backend",
        label: "acme/backend",
        name: "Backend",
        kind: "team" as const,
        suggested: false,
        reviewState: null,
      },
    ],
  }
}

export const DEMO_PROJECT = {
  owner: "acme",
  number: 7,
  title: "Acme Product",
  id: "PVT_demo",
} as const

const STATUSES: SprintStatus[] = [
  { id: "todo", name: "Todo", color: "#8b949e" },
  { id: "progress", name: "In progress", color: "#d29922" },
  { id: "review", name: "In review", color: "#4493f8" },
  { id: "ready", name: "Ready to merge", color: "#ab7df8" },
  { id: "done", name: "Done", color: "#3fb950" },
]

const PRIORITIES: SprintStatus[] = [
  { id: "p0", name: "P0", color: "#f85149" },
  { id: "p1", name: "P1", color: "#db6d28" },
  { id: "p2", name: "P2", color: "#d29922" },
  { id: "p3", name: "P3", color: "#8b949e" },
]

export const DEMO_BOARD = {
  statusFieldId: "status",
  statuses: STATUSES,
  priorityField: { id: "priority", name: "Priority", options: PRIORITIES },
}

const LABEL_COLOR: Record<string, string> = {
  bug: "d73a4a",
  enhancement: "a2eeef",
  api: "1d76db",
  ui: "c5def5",
  infra: "fbca04",
  billing: "0e8a16",
  observability: "5319e7",
  design: "f9d0c4",
  epic: "3e4b9e",
}

/** « Mes issues »: the current sprint of Acme Product, and Jane's issues. */
export function demoSprint(now: Date): {
  sprint: Sprint
  assigned: WorkItem[]
} {
  const start = weekStart(now)
  start.setDate(start.getDate() - 7)
  const iteration = {
    title: "Sprint 42",
    startDate: start.toISOString().slice(0, 10),
    duration: 14,
  }
  const work = (
    repo: string,
    number: number,
    title: string,
    fields: {
      kind?: WorkItem["kind"]
      status: string
      assignees: string[]
      labels?: string[]
      urgency?: number | null
      hoursAgo?: number
      state?: WorkItem["state"]
    }
  ): WorkItem => ({
    key: `${repo}#${number}`,
    kind: fields.kind ?? "issue",
    number,
    title,
    url:
      fields.kind === "pull" ? pullUrl(repo, number) : issueUrl(repo, number),
    repo,
    state: fields.state ?? "OPEN",
    assignees: fields.assignees,
    labels: (fields.labels ?? []).map((name) => ({
      name,
      color: LABEL_COLOR[name] ?? "ededed",
    })),
    updatedAt: ago(now, (fields.hoursAgo ?? 6) * HOUR_MS).toISOString(),
    status: fields.status,
    sprint: iteration.title,
    isEpic: fields.labels?.includes("epic") ?? false,
    projectItemId: `PVTI_${repo.replace("/", "_")}_${number}`,
    urgency: fields.urgency ?? null,
  })
  const items = [
    work("acme/api", 398, "Webhook retries flood the logs", {
      status: "Todo",
      assignees: [ME, "sam-lee"],
      labels: ["bug", "observability"],
      urgency: 2.1,
      hoursAgo: 1,
    }),
    work("acme/web", 236, "Checkout button disabled on Safari 18", {
      status: "In review",
      assignees: ["priya-shah"],
      labels: ["bug"],
      urgency: 2.9,
      hoursAgo: 2,
    }),
    work("acme/api", 397, "Public API has no rate limiting", {
      status: "In review",
      assignees: ["alex-martin"],
      labels: ["api"],
      urgency: 2.3,
    }),
    work("acme/api", 410, "Usage reports: CSV export", {
      status: "Ready to merge",
      assignees: [ME],
      labels: ["enhancement"],
      urgency: 1.1,
    }),
    work("acme/web", 233, "Dark mode for the settings page", {
      status: "In progress",
      assignees: ["nina-rossi"],
      labels: ["ui"],
      urgency: 1.4,
      hoursAgo: 5,
    }),
    work("acme/api", 402, "Billing: move invoices to the new service", {
      status: "In progress",
      assignees: ["sam-lee"],
      labels: ["billing", "epic"],
      urgency: 1.7,
      hoursAgo: 7,
    }),
    work("acme/web", 239, "Upgrade the web app to React 19", {
      status: "In progress",
      assignees: [ME],
      labels: ["enhancement"],
      urgency: 1.5,
      hoursAgo: 4,
    }),
    work("acme/infra", 54, "Postgres 17 on staging and production", {
      status: "Todo",
      assignees: ["tom-becker"],
      labels: ["infra"],
      urgency: 0.8,
      hoursAgo: 20,
    }),
    work("acme/web", 245, "Empty state for the search page", {
      status: "Todo",
      assignees: [],
      labels: ["ui"],
      urgency: 0.5,
      hoursAgo: 30,
    }),
    work("acme/api", 392, "Document the pagination of /usage", {
      status: "Done",
      assignees: [ME],
      urgency: 0.3,
      hoursAgo: 26,
      state: "CLOSED",
    }),
    work("acme/web", 228, "Broken avatar fallback in the header", {
      status: "Done",
      assignees: ["nina-rossi"],
      labels: ["bug"],
      urgency: 0.4,
      hoursAgo: 27,
      state: "CLOSED",
    }),
  ]
  const assigned = [
    ...items.filter(
      (item) => item.assignees.includes(ME) && item.state === "OPEN"
    ),
    work("acme/infra", 49, "Rotate the staging database credentials", {
      status: "Todo",
      assignees: [ME],
      labels: ["infra"],
      urgency: 1.2,
      hoursAgo: 72,
    }),
  ].map((item) =>
    item.key === "acme/infra#49" ? { ...item, sprint: null } : item
  )
  return {
    sprint: {
      project: { ...DEMO_PROJECT },
      statusFieldId: DEMO_BOARD.statusFieldId,
      iteration,
      statuses: STATUSES,
      items,
    },
    assigned,
  }
}

export function demoWeek(now: Date): WeekSummary {
  const since = weekStart(now)
  const entry = (
    repo: string,
    number: number,
    label: string,
    hoursAfterMonday: number,
    author: string | null = ME
  ): WeekEntry => ({
    key: `${repo}#${number}`,
    label,
    url: pullUrl(repo, number),
    repo,
    number,
    at: new Date(
      Math.min(since.getTime() + hoursAfterMonday * HOUR_MS, now.getTime())
    ).toISOString(),
    author,
    count: 1,
  })
  return {
    since: since.toISOString(),
    shipped: [
      entry("acme/api", 392, "Document the pagination of /usage", 10),
      entry("acme/web", 234, "Faster product search", 30),
    ],
    started: [
      entry("acme/api", 415, "Export usage reports as CSV", 26),
      entry("acme/web", 240, "Upgrade to React 19", 32),
    ],
    reviewed: [
      entry(
        "acme/web",
        229,
        "Broken avatar fallback in the header",
        8,
        "nina-rossi"
      ),
      entry(
        "acme/web",
        231,
        "Dark mode for the settings page",
        20,
        "nina-rossi"
      ),
      entry("acme/web", 226, "Split the cart store", 28, "priya-shah"),
    ],
    closed: [entry("acme/api", 392, "Document the pagination of /usage", 10)],
  }
}

export function demoStandups(now: Date, date: string) {
  const at = (minutes: number) => ago(now, minutes * 60_000).toISOString()
  const team: StandupState = {
    status: "done",
    date,
    startedAt: at(70),
    finishedAt: at(64),
    message:
      "**Point d'équipe, Sprint 42**\n\n- **Alex** : rate limiting de l'API en review (acme/api#412), attend Jane.\n- **Priya** : fix Safari du paiement en review, prioritaire (conversion en baisse).\n- **Sam** : migration des factures, attend une review backend depuis 4 jours.\n- **Nina** : dark mode des réglages, retours de review en cours.\n- **Tom** : Postgres 17 sur staging, le plan Terraform échoue.\n\n**Bloqué** : acme/api#388 a des conflits depuis 12 jours.",
    slackMessage: null,
    channelId: "C05DAILY",
    threadTs: "1760000000.000100",
    alreadyPosted: false,
    postedAt: null,
    postedLink: null,
    note: null,
    error: null,
  }
  const me: StandupState = {
    ...team,
    startedAt: at(40),
    finishedAt: at(38),
    message:
      "- **Hier** : export CSV des rapports d'usage (acme/api#415, approuvée), 3 reviews.\n- **Aujourd'hui** : review du rate limiting, CI de la montée en React 19.\n- **Bloquants** : aucun.",
  }
  return { team, me }
}
