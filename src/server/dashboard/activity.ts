import { sql } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { activity, dailyStats } from "@/server/db/schema"
import type { View } from "@/server/db/schema"

/** Folders whose arrivals and departures make the trends. */
const TRACKED: View[] = ["review", "awaiting"]

export type ActivityRow = typeof activity.$inferInsert

/**
 * What a view change means for the trends: leaving a waiting folder is work
 * done, entering one is work arriving. `enteredAt` dates the arrival when the
 * request or message is older than the sync that found it.
 */
export function viewTransitions(
  itemKey: string,
  before: View,
  after: View,
  now: Date,
  enteredAt: Date | null = null
): ActivityRow[] {
  if (before === after) return []
  const rows: ActivityRow[] = []
  if (TRACKED.includes(before))
    rows.push({ at: now, kind: "left", view: before, itemKey })
  if (TRACKED.includes(after))
    rows.push({ at: enteredAt ?? now, kind: "entered", view: after, itemKey })
  return rows
}

export async function recordActivity(db: Database, rows: ActivityRow[]) {
  if (rows.length > 0) await db.insert(activity).values(rows)
}

/** Keeps the day's lowest and highest ping count. */
export async function recordDailyPings(
  db: Database,
  date: string,
  pings: number
) {
  await db
    .insert(dailyStats)
    .values({ date, minPings: pings, maxPings: pings })
    .onConflictDoUpdate({
      target: dailyStats.date,
      set: {
        minPings: sql`least(${dailyStats.minPings}, ${pings})`,
        maxPings: sql`greatest(${dailyStats.maxPings}, ${pings})`,
      },
    })
}
