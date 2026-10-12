import { localDate } from "@/server/recap/schedule"

export type DayFlow = { date: string; entered: number; left: number }

/** Arrivals and departures per local day, oldest first, empty days included. */
export function dailyFlow(
  rows: { at: Date; kind: "entered" | "left" }[],
  now: Date,
  days = 14
): DayFlow[] {
  const flow = new Map<string, DayFlow>()
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset
    )
    const date = localDate(day)
    flow.set(date, { date, entered: 0, left: 0 })
  }
  for (const row of rows) {
    const day = flow.get(localDate(row.at))
    if (day) day[row.kind] += 1
  }
  return [...flow.values()]
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Hours between each review request and the viewer's review that followed it. */
export function reviewDelays(
  items: { requestedAt: Date | null; reviewedAt: Date | null }[]
): number[] {
  return items.flatMap(({ requestedAt, reviewedAt }) =>
    requestedAt && reviewedAt && reviewedAt >= requestedAt
      ? [(reviewedAt.getTime() - requestedAt.getTime()) / 3_600_000]
      : []
  )
}

/**
 * Consecutive days, back from today, where the inbox reached zero pings.
 * Today only counts once reached, so an unfinished day keeps the streak alive.
 */
export function zeroPingStreak(
  days: { date: string; minPings: number }[],
  now: Date
): number {
  const reached = new Set(
    days.filter((day) => day.minPings === 0).map((day) => day.date)
  )
  let streak = 0
  let offset = reached.has(localDate(now)) ? 0 : 1
  for (;;) {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - offset
    )
    if (!reached.has(localDate(day))) return streak
    streak += 1
    offset += 1
  }
}

export type RepoShare = { repo: string; count: number; share: number }

/** The repositories that send the most notifications. */
export function noisyRepos(
  counts: { repo: string; count: number }[],
  limit = 5
): RepoShare[] {
  const total = counts.reduce((sum, { count }) => sum + count, 0)
  return [...counts]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ repo, count }) => ({
      repo,
      count,
      share: total ? count / total : 0,
    }))
}
