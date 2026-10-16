import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import type { PriorityReason } from "@/server/inbox/priority"
import type { Readiness } from "@/server/readiness/rules"

export const settings = snakeCase.table("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
})

export const repos = snakeCase.table("repos", {
  fullName: text().primaryKey(),
  tracked: boolean().notNull().default(true),
  addedManually: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type SubjectKind = "PullRequest" | "Issue" | "Discussion" | "Other"

export type View = "review" | "awaiting" | "mine" | "other"

/**
 * One row per GitHub subject (PR, issue…). GitHub keeps a single notification
 * thread per subject, so the subject key also deduplicates search results.
 */
export const items = snakeCase.table("items", {
  key: text().primaryKey(),
  repoFullName: text().notNull(),
  number: integer(),
  kind: text().$type<SubjectKind>().notNull(),
  /** Notification subject type (PullRequest, Issue, Release, CheckSuite…). */
  subjectType: text(),
  title: text().notNull(),
  htmlUrl: text().notNull(),
  threadId: text(),
  reason: text().notNull(),
  unread: boolean().notNull().default(true),
  view: text().$type<View>().notNull().default("other"),
  updatedAt: timestamp({ withTimezone: true }).notNull(),

  state: text(),
  isDraft: boolean().notNull().default(false),
  author: text(),
  labels: text().array().notNull().default([]),
  additions: integer(),
  deletions: integer(),
  changedFiles: integer(),
  ciState: text(),
  reviewDecision: text(),
  reviewRequest: text().$type<"direct" | "team" | null>(),
  approvals: integer().notNull().default(0),
  pendingReviewers: integer().notNull().default(0),
  requestedAt: timestamp({ withTimezone: true }),

  /** Head commit, and the commit of the viewer's latest review. */
  headOid: text(),
  reviewedOid: text(),
  reviewedAt: timestamp({ withTimezone: true }),
  reviewedState: text(),

  /** Whether the viewer's own PR can be merged, or what it still misses. */
  mergeStateStatus: text(),
  readiness: jsonb().$type<Readiness>(),

  awaitingMe: boolean().notNull().default(false),
  awaitingUrl: text(),
  awaitingExcerpt: text(),
  awaitingFrom: text(),
  awaitingSince: timestamp({ withTimezone: true }),

  aiUrgency: real(),
  aiConfidence: real(),
  aiQuestionProbability: real(),
  aiHash: text(),

  priority: integer().notNull().default(0),
  priorityReasons: jsonb().$type<PriorityReason[]>().notNull().default([]),
  needsCheck: boolean().notNull().default(false),

  enrichedAt: timestamp({ withTimezone: true }),
  doneAt: timestamp({ withTimezone: true }),
  /** Set when an automatic rule marked the item done, with the rule's label. */
  autoDoneReason: text(),
  snoozedUntil: timestamp({ withTimezone: true }),
})

export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert

export type SlackMatch = "link" | "reference" | "title"

export type SlackDiscussion = {
  channel: string
  permalink: string
  match: SlackMatch
  messages: { author: string; text: string; postedAt: string }[]
}

/** Cached result of the agent-driven Slack search, one row per subject. */
export const slackLookups = snakeCase.table("slack_lookups", {
  itemKey: text().primaryKey(),
  status: text().$type<"pending" | "done" | "error">().notNull(),
  discussions: jsonb().$type<SlackDiscussion[]>().notNull().default([]),
  error: text(),
  agent: text().notNull(),
  startedAt: timestamp({ withTimezone: true }).notNull(),
  finishedAt: timestamp({ withTimezone: true }),
})

export type SlackLookup = typeof slackLookups.$inferSelect

export const SUMMARY_LENGTHS = ["short", "standard", "detailed"] as const
export type SummaryLength = (typeof SUMMARY_LENGTHS)[number]

export type SummaryContent = {
  tldr: string
  status: string
  expectedFromMe: string
  openQuestions: string[]
  risks: string[]
}

/** AI summary of a PR or issue per length, kept until the user asks for a new one. */
export const summaries = snakeCase.table(
  "summaries",
  {
    itemKey: text().notNull(),
    length: text().$type<SummaryLength>().notNull().default("detailed"),
    content: jsonb().$type<SummaryContent>().notNull(),
    model: text().notNull(),
    /** Subject activity time when summarised, to tell when it is out of date. */
    sourceUpdatedAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.itemKey, table.length] })]
)

export type Summary = typeof summaries.$inferSelect

export const ATTENTION_KINDS = [
  "review",
  "awaiting",
  "changes",
  "ci",
  "recap",
] as const
export type AttentionKind = (typeof ATTENTION_KINDS)[number]

/** Something that newly needs the viewer, turned into a browser notification. */
export const attentionEvents = snakeCase.table("attention_events", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  itemKey: text().notNull(),
  kind: text().$type<AttentionKind>().notNull(),
  title: text().notNull(),
  body: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type AttentionEvent = typeof attentionEvents.$inferSelect

export type TeamProblem =
  "no-reviewer" | "stale" | "ci" | "conflict" | "changes"

/** Open PRs of the tracked repos, by others: the team's flow, not the viewer's inbox. */
export const teamPulls = snakeCase.table("team_pulls", {
  key: text().primaryKey(),
  repoFullName: text().notNull(),
  number: integer().notNull(),
  title: text().notNull(),
  htmlUrl: text().notNull(),
  author: text(),
  isDraft: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
  additions: integer().notNull().default(0),
  deletions: integer().notNull().default(0),
  reviewers: text().array().notNull().default([]),
  reviewDecision: text(),
  ciState: text(),
  mergeable: text(),
  problems: text().$type<TeamProblem>().array().notNull().default([]),
  readiness: jsonb().$type<Readiness>(),
  syncedAt: timestamp({ withTimezone: true }).notNull(),
})

export type TeamPull = typeof teamPulls.$inferSelect

/** Items entering or leaving a folder that waits for the viewer, for the trends. */
export const activity = snakeCase.table(
  "activity",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp({ withTimezone: true }).notNull(),
    kind: text().$type<"entered" | "left">().notNull(),
    view: text().$type<View>().notNull(),
    itemKey: text().notNull(),
  },
  (table) => [index().on(table.at)]
)

/** Lowest and highest ping count of each local day, for the Zéro Ping streak. */
export const dailyStats = snakeCase.table("daily_stats", {
  date: text().primaryKey(),
  minPings: integer().notNull(),
  maxPings: integer().notNull(),
})

/**
 * Jev's urgency for PRs and issues outside the inbox (team PRs, sprint
 * tickets), keyed by `owner/repo#number`. The hash avoids re-asking Jev
 * while the subject has not changed.
 */
export const aiScores = snakeCase.table("ai_scores", {
  key: text().primaryKey(),
  hash: text().notNull(),
  urgency: real().notNull(),
  confidence: real(),
  scoredAt: timestamp({ withTimezone: true }).notNull(),
})

/** Slack threads the viewer marked read, up to the latest message they saw. */
export const slackReads = snakeCase.table("slack_reads", {
  permalink: text().primaryKey(),
  /** `postedAt` of the newest message when it was marked read. */
  readThrough: text().notNull(),
  readAt: timestamp({ withTimezone: true }).notNull(),
})

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  at: string
}

/** Questions the viewer asked the AI about an item, with the answers. */
export const itemChats = snakeCase.table("item_chats", {
  itemKey: text().primaryKey(),
  messages: jsonb().$type<ChatMessage[]>().notNull().default([]),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
})

/** Jev's KPIs of a PR, kept while the PR's state hashes the same. */
export const pullInsights = snakeCase.table("pull_insights", {
  itemKey: text().primaryKey(),
  hash: text().notNull(),
  insights: jsonb().$type<PullInsight[]>().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
})

export type PullInsight = {
  id: string
  /** Index of the answered level, or 1/0 for a yes/no question. */
  level: number
  /** P(yes) for a yes/no question, the fractional level otherwise. */
  value: number
  confidence: number | null
}

/** When the viewer marked an item's AI summary read. */
export const summaryReads = snakeCase.table("summary_reads", {
  itemKey: text().primaryKey(),
  readAt: timestamp({ withTimezone: true }).notNull(),
})
