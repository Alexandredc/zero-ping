import {
  boolean,
  integer,
  jsonb,
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
