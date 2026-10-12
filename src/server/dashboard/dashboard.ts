import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import {
  activity,
  dailyStats,
  items,
  repos,
  teamPulls,
} from "@/server/db/schema"
import type { TeamProblem } from "@/server/db/schema"
import type { Viewer } from "@/server/inbox/analyze"
import { localDate } from "@/server/recap/schedule"
import {
  dailyFlow,
  median,
  noisyRepos,
  reviewDelays,
  zeroPingStreak,
} from "./trends"
import { teamWeather } from "./weather"
import { summarizeWorkload } from "./workload"

const DAY_MS = 24 * 60 * 60 * 1000
const FLOW_DAYS = 14
const DELAY_DAYS = 30

export async function buildDashboard(
  db: Database,
  viewer: Viewer,
  options: { reviewSlaHours: number },
  now: Date = new Date()
) {
  const flowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (FLOW_DAYS - 1)
  )
  const tracked = eq(repos.tracked, true)
  const active = and(
    tracked,
    isNull(items.doneAt),
    or(isNull(items.snoozedUntil), lte(items.snoozedUntil, now)),
    inArray(items.view, ["review", "awaiting", "mine"])
  )

  const [activeItems, flowRows, reviewed, streakDays, repoCounts, pulls] =
    await Promise.all([
      db
        .select({ item: items })
        .from(items)
        .innerJoin(repos, eq(repos.fullName, items.repoFullName))
        .where(active)
        .orderBy(desc(items.priority), desc(items.updatedAt))
        .then((rows) => rows.map((row) => row.item)),
      db
        .select({ at: activity.at, kind: activity.kind })
        .from(activity)
        .where(gte(activity.at, flowStart)),
      db
        .select({
          requestedAt: items.requestedAt,
          reviewedAt: items.reviewedAt,
        })
        .from(items)
        .where(
          gte(items.reviewedAt, new Date(now.getTime() - DELAY_DAYS * DAY_MS))
        ),
      db
        .select()
        .from(dailyStats)
        .where(
          gte(dailyStats.date, localDate(new Date(now.getTime() - 90 * DAY_MS)))
        ),
      db
        .select({
          repo: items.repoFullName,
          count: sql<number>`count(*)::int`,
        })
        .from(items)
        .innerJoin(repos, eq(repos.fullName, items.repoFullName))
        .where(and(tracked, gte(items.updatedAt, flowStart)))
        .groupBy(items.repoFullName),
      db.select().from(teamPulls),
    ])

  const workload = summarizeWorkload(activeItems)
  const slaMs = options.reviewSlaHours * 3_600_000
  const overSla = activeItems.filter(
    (item) =>
      item.view === "review" &&
      item.requestedAt !== null &&
      now.getTime() - item.requestedAt.getTime() > slaMs
  )
  const mine = activeItems.filter((item) => item.view === "mine")

  const teamProblems: Partial<Record<TeamProblem, number>> = {}
  for (const pull of pulls)
    for (const problem of pull.problems.slice(0, 1))
      teamProblems[problem] = (teamProblems[problem] ?? 0) + 1

  const flow = dailyFlow(flowRows, now, FLOW_DAYS)
  return {
    workload: {
      totalMinutes: workload.totalMinutes,
      byView: workload.byView,
      counts: {
        review: activeItems.filter((item) => item.view === "review").length,
        awaiting: activeItems.filter((item) => item.view === "awaiting").length,
        mine: mine.length,
      },
      actions: workload.actions.map(({ item, ...action }) => ({
        ...action,
        key: item.key,
        view: item.view,
        title: item.title,
        repoFullName: item.repoFullName,
        number: item.number,
        priority: item.priority,
        author: item.author,
      })),
    },
    team: {
      problems: teamProblems,
      stuck: pulls.filter((pull) => pull.problems.length > 0).length,
      open: pulls.length,
    },
    trends: {
      flow,
      enteredTotal: flow.reduce((sum, day) => sum + day.entered, 0),
      leftTotal: flow.reduce((sum, day) => sum + day.left, 0),
      medianReviewHours: median(reviewDelays(reviewed)),
      reviewsMeasured: reviewDelays(reviewed).length,
      slaHours: options.reviewSlaHours,
      overSla: overSla.map((item) => ({
        key: item.key,
        title: item.title,
        repoFullName: item.repoFullName,
        number: item.number,
        requestedAt: item.requestedAt,
      })),
      streak: zeroPingStreak(streakDays, now),
      streakTracked: streakDays.length > 0,
      noisyRepos: noisyRepos(repoCounts),
    },
    weather: teamWeather(pulls, {
      login: viewer.login,
      reviewsDue: activeItems.filter((item) => item.view === "review").length,
      openPulls: mine.length,
      blocked: mine.filter(
        (item) =>
          item.ciState === "FAILURE" ||
          item.ciState === "ERROR" ||
          item.reviewDecision === "CHANGES_REQUESTED"
      ).length,
    }),
  }
}

export type Dashboard = Awaited<ReturnType<typeof buildDashboard>>
