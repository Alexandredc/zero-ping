import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { items, repos, settings, teamPulls } from "@/server/db/schema"
import { recordAttention } from "@/server/inbox/attention"
import { getPreferences } from "@/server/preferences"
import { isRecapDue, localDate } from "./schedule"
import { startStandup } from "./standup"

export type RecapCounts = {
  review: number
  awaiting: number
  ciFailing: number
  readyToMerge: number
  team: number
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count > 1 ? many : one}`

/** "3 reviews, 2 réponses attendues, 1 CI rouge", or a calm sentence. */
export function recapLine(counts: RecapCounts): string {
  const parts = [
    counts.review > 0 && plural(counts.review, "review", "reviews"),
    counts.awaiting > 0 &&
      plural(counts.awaiting, "réponse attendue", "réponses attendues"),
    counts.ciFailing > 0 && plural(counts.ciFailing, "CI rouge", "CI rouges"),
    counts.readyToMerge > 0 &&
      plural(counts.readyToMerge, "PR à merger", "PR à merger"),
    counts.team > 0 &&
      plural(counts.team, "PR d'équipe bloquée", "PR d'équipe bloquées"),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : "Rien ne t'attend ce matin."
}

function activeCondition(now: Date) {
  return and(
    eq(repos.tracked, true),
    isNull(items.doneAt),
    or(isNull(items.snoozedUntil), lte(items.snoozedUntil, now))
  )
}

export async function buildRecap(db: Database, now: Date = new Date()) {
  const active = activeCondition(now)
  const count = async (condition: ReturnType<typeof and>) => {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .innerJoin(repos, eq(repos.fullName, items.repoFullName))
      .where(and(active, condition))
    return row.count
  }
  const top = (view: "review" | "awaiting" | "mine") =>
    db
      .select({ item: items })
      .from(items)
      .innerJoin(repos, eq(repos.fullName, items.repoFullName))
      .where(and(active, eq(items.view, view)))
      .orderBy(desc(items.priority), desc(items.updatedAt))
      .limit(5)
      .then((rows) => rows.map((row) => row.item))

  const [review, awaiting, ciFailing, readyToMerge, team, lists] =
    await Promise.all([
      count(eq(items.view, "review")),
      count(eq(items.view, "awaiting")),
      count(
        and(
          eq(items.view, "mine"),
          sql`${items.ciState} in ('FAILURE', 'ERROR')`
        )
      ),
      count(and(eq(items.view, "mine"), eq(items.reviewDecision, "APPROVED"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(teamPulls)
        .where(sql`cardinality(${teamPulls.problems}) > 0`)
        .then(([row]) => row.count),
      Promise.all([top("review"), top("awaiting"), top("mine")]),
    ])
  const counts = { review, awaiting, ciFailing, readyToMerge, team }
  return {
    counts,
    line: recapLine(counts),
    review: lists[0],
    awaiting: lists[1],
    mine: lists[2],
  }
}

const RECAP_KEY = "recap"

async function lastRecapDate(db: Database): Promise<string | null> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, RECAP_KEY))
  ).at(0)
  return (row?.value as { date?: string } | undefined)?.date ?? null
}

/**
 * Checked on every sync: once a working day, notifies the recap and starts
 * the team standup.
 */
export async function runDailyRecap(db: Database, now: Date = new Date()) {
  const preferences = await getPreferences(db)
  if (!preferences.recapEnabled) return
  if (!isRecapDue(now, preferences.recapTime, await lastRecapDate(db))) return
  const date = localDate(now)
  await db
    .insert(settings)
    .values({ key: RECAP_KEY, value: { date } })
    .onConflictDoUpdate({ target: settings.key, set: { value: { date } } })
  const recap = await buildRecap(db, now)
  await recordAttention(db, [
    {
      itemKey: "recap",
      kind: "recap",
      title: "Ton récap du jour",
      body: recap.line,
    },
  ])
  if (preferences.standupEnabled) void startStandup(db, date)
}
