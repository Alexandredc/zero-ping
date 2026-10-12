import {
  boolean,
  integer,
  jsonb,
  primaryKey,
  snakeCase,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import type { PriorityReason } from "@/server/inbox/priority"

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
  ciState: text(),
  reviewDecision: text(),
  reviewRequest: text().$type<"direct" | "team" | null>(),
  approvals: integer().notNull().default(0),
  pendingReviewers: integer().notNull().default(0),
  requestedAt: timestamp({ withTimezone: true }),

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

export const ATTENTION_KINDS = ["review", "awaiting", "changes", "ci"] as const
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
