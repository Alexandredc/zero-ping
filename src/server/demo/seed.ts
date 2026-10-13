import { sql } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import {
  activity,
  aiScores,
  attentionEvents,
  dailyStats,
  itemChats,
  items,
  pullInsights,
  repos,
  settings,
  slackLookups,
  slackReads,
  summaries,
  summaryReads,
  teamPulls,
} from "@/server/db/schema"
import type { NewItem, SummaryLength } from "@/server/db/schema"
import { computePriority } from "@/server/inbox/priority"
import { preferencesSchema } from "@/server/preferences"
import { localDate } from "@/server/recap/schedule"
import {
  DEMO_INSIGHTS,
  DEMO_PROJECT,
  DEMO_REPOS,
  DEMO_TEAM_SCORES,
  demoChats,
  demoItems,
  demoSlack,
  demoStandups,
  demoSummaries,
  demoTeamPulls,
} from "./fixtures"

/** Settings row that tells a demo database from a real one. */
export const DEMO_MARKER = "demo"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Refuses to wipe a database that holds real data: only an empty database or
 * one this seed wrote before may be reset.
 */
export async function assertDemoDatabase(db: Database) {
  const marker = (
    await db
      .select()
      .from(settings)
      .where(sql`${settings.key} = ${DEMO_MARKER}`)
  ).at(0)
  if (marker) return
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(items)
  if (count > 0)
    throw new Error(
      "Cette base contient de vraies données : le mode démo ne l'écrase pas. Utilise un DATA_DIR vide."
    )
}

/** Inbox items with the priority the live sync would give them. */
export function scoredItems(now: Date): NewItem[] {
  return demoItems(now).map((item) => {
    const { priority, reasons, needsCheck } = computePriority(
      {
        kind: item.kind,
        view: item.view ?? "other",
        isDraft: item.isDraft ?? false,
        state: item.state ?? null,
        labels: item.labels ?? [],
        additions: item.additions ?? null,
        deletions: item.deletions ?? null,
        ciState: item.ciState ?? null,
        reviewDecision: item.reviewDecision ?? null,
        reviewRequest: item.reviewRequest ?? null,
        approvals: item.approvals ?? 0,
        pendingReviewers: item.pendingReviewers ?? 0,
        headOid: item.headOid ?? null,
        reviewedOid: item.reviewedOid ?? null,
        reviewedState: item.reviewedState ?? null,
        awaitingMe: item.awaitingMe ?? false,
        waitingSince: item.awaitingSince ?? item.requestedAt ?? null,
        aiUrgency: item.aiUrgency ?? null,
        aiConfidence: item.aiConfidence ?? null,
        aiQuestionProbability: item.aiQuestionProbability ?? null,
      },
      now
    )
    return { ...item, priority, priorityReasons: reasons, needsCheck }
  })
}

/** Folder moves of the last two weeks, for the dashboard's flow chart. */
function demoActivity(now: Date) {
  const rows: (typeof activity.$inferInsert)[] = []
  for (let day = 13; day >= 1; day--) {
    const date = new Date(now.getTime() - day * DAY_MS)
    const weekend = date.getDay() === 0 || date.getDay() === 6
    const entered = weekend ? 0 : 3 + ((day * 7) % 5)
    const left = weekend ? 1 : 2 + ((day * 5) % 6)
    for (let i = 0; i < entered; i++)
      rows.push({
        at: new Date(date.getTime() + i * 60_000),
        kind: "entered",
        view: "review",
        itemKey: `acme/api#${300 + day * 10 + i}`,
      })
    for (let i = 0; i < left; i++)
      rows.push({
        at: new Date(date.getTime() + (i + 30) * 60_000),
        kind: "left",
        view: "review",
        itemKey: `acme/web#${100 + day * 10 + i}`,
      })
  }
  return rows
}

/** A Zéro Ping streak: the inbox emptied on most recent working days. */
function demoDailyStats(now: Date) {
  return Array.from({ length: 20 }, (_, index) => {
    const date = new Date(now.getTime() - (index + 1) * DAY_MS)
    return {
      date: localDate(date),
      minPings: index < 6 || index % 4 !== 0 ? 0 : 2,
      maxPings: 4 + (index % 5),
    }
  })
}

/**
 * Resets the database to the demo's fictional data, dated from `now`. Run at
 * every demo start, so the inbox always looks like this morning's.
 */
export async function seedDemo(db: Database, now: Date = new Date()) {
  await assertDemoDatabase(db)
  await db.transaction(async (tx) => {
    for (const table of [
      items,
      repos,
      slackLookups,
      slackReads,
      summaries,
      summaryReads,
      itemChats,
      pullInsights,
      teamPulls,
      activity,
      dailyStats,
      aiScores,
      attentionEvents,
      settings,
    ])
      await tx.delete(table)

    await tx
      .insert(repos)
      .values(DEMO_REPOS.map((fullName) => ({ fullName, tracked: true })))
    await tx.insert(items).values(scoredItems(now))
    await tx.insert(teamPulls).values(demoTeamPulls(now))
    await tx.insert(aiScores).values(
      Object.entries(DEMO_TEAM_SCORES).map(([key, urgency]) => ({
        key,
        hash: "demo",
        urgency,
        confidence: 0.8,
        scoredAt: now,
      }))
    )

    // Every PR and issue has a finished Slack search, so none is started.
    const slack = demoSlack(now)
    const searchable = [
      ...demoItems(now).filter((item) => item.number !== null),
      ...demoTeamPulls(now),
      ...Object.keys(slack).map((key) => ({ key })),
    ]
    await tx.insert(slackLookups).values(
      [...new Set(searchable.map((item) => item.key))].map((key) => ({
        itemKey: key,
        status: "done" as const,
        discussions: slack[key] ?? [],
        agent: "claude",
        startedAt: now,
        finishedAt: now,
      }))
    )

    const itemUpdatedAt = new Map(
      demoItems(now).map((item) => [item.key, item.updatedAt])
    )
    await tx.insert(summaries).values(
      Object.entries(demoSummaries()).flatMap(([itemKey, byLength]) =>
        Object.entries(byLength).map(([length, content]) => ({
          itemKey,
          length: length as SummaryLength,
          content,
          model: "sonnet",
          sourceUpdatedAt: itemUpdatedAt.get(itemKey) ?? now,
          createdAt: now,
        }))
      )
    )
    await tx.insert(itemChats).values(
      Object.entries(demoChats(now)).map(([itemKey, messages]) => ({
        itemKey,
        messages,
        updatedAt: now,
      }))
    )
    await tx.insert(pullInsights).values(
      Object.entries(DEMO_INSIGHTS).map(([itemKey, insights]) => ({
        itemKey,
        hash: "demo",
        insights,
        createdAt: now,
      }))
    )
    await tx.insert(activity).values(demoActivity(now))
    await tx.insert(dailyStats).values(demoDailyStats(now))

    const today = localDate(now)
    const standups = demoStandups(now, today)
    const preferences = preferencesSchema.parse({
      standupEnabled: true,
      myStandupEnabled: true,
      standupChannel: "daily",
      reviewNoticeChannel: "pull-requests",
      sprintProject: `${DEMO_PROJECT.owner}/${DEMO_PROJECT.number}`,
    })
    await tx.insert(settings).values([
      { key: DEMO_MARKER, value: { seededAt: now.toISOString() } },
      { key: "preferences", value: preferences },
      { key: "standup", value: standups.team },
      { key: "standup:me", value: standups.me },
      // Today's recap already ran: the demo never notifies.
      { key: "recap", value: { date: today } },
    ])
  })
}
