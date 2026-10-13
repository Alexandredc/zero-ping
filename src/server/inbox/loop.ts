import { getDb } from "@/server/db/client"
import { getOctokit, getViewer } from "@/server/github/client"
import { attentionReady, markAttentionReady } from "@/server/inbox/attention"
import {
  ENRICH_LIMIT,
  enrichItems,
  pollNotifications,
  rescoreAll,
  searchMissingSubjects,
} from "@/server/inbox/sync"
import { prefetchLookups } from "@/server/slack/lookups"
import { applyAutoRules } from "@/server/inbox/auto-done"
import { getPreferences } from "@/server/preferences"
import { runDailyRecap } from "@/server/recap/recap"
import { syncTeamPulls } from "@/server/team/pulls"
import { repos } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { recordDailyPings } from "@/server/dashboard/activity"
import { countPings, warmProjectCaches } from "@/server/inbox/actions"
import { localDate } from "@/server/recap/schedule"

export type SyncStatus = {
  running: boolean
  lastSyncAt: string | null
  lastError: string | null
  nextSyncAt: string | null
  /** The shortest wait GitHub allows between two notification polls. */
  githubIntervalS: number | null
}

type LoopState = {
  status: SyncStatus
  timer: ReturnType<typeof setTimeout> | null
  current: Promise<void> | null
  lastTeamSyncAt: number
}

const MIN_INTERVAL_S = 30
const TEAM_SYNC_MS = 10 * 60 * 1000

const globalForLoop = globalThis as unknown as { __githubInboxLoop?: LoopState }

function state(): LoopState {
  globalForLoop.__githubInboxLoop ??= {
    status: {
      running: false,
      lastSyncAt: null,
      lastError: null,
      nextSyncAt: null,
      githubIntervalS: null,
    },
    timer: null,
    current: null,
    lastTeamSyncAt: 0,
  }
  return globalForLoop.__githubInboxLoop
}

async function runOnce(forceSearch: boolean): Promise<number> {
  const [db, octokit, viewer] = await Promise.all([
    getDb(),
    getOctokit(),
    getViewer(),
  ])
  const { pollInterval } = await pollNotifications(db, octokit)
  await searchMissingSubjects(db, octokit, forceSearch)
  const notify = await attentionReady(db)
  const enriched = await enrichItems(db, octokit, viewer, undefined, { notify })
  // The initial backlog is done once a sync no longer fills a whole batch.
  if (!notify && enriched < ENRICH_LIMIT) await markAttentionReady(db)
  await rescoreAll(db)
  const preferences = await getPreferences(db)
  await applyAutoRules(db, octokit, preferences)
  const loop = state()
  if (forceSearch || Date.now() - loop.lastTeamSyncAt > TEAM_SYNC_MS) {
    const tracked = await db
      .select({ fullName: repos.fullName })
      .from(repos)
      .where(eq(repos.tracked, true))
    await syncTeamPulls(db, octokit, {
      repos: tracked.map((repo) => repo.fullName),
      viewerLogin: viewer.login,
      staleDays: preferences.teamStaleDays,
    })
    loop.lastTeamSyncAt = Date.now()
  }
  await runDailyRecap(db)
  await recordDailyPings(db, localDate(new Date()), await countPings())
  // Keeps the project caches warm, so a panel never waits for the project list.
  void warmProjectCaches().catch((error: unknown) =>
    console.error("[projects]", error)
  )
  // Agent sessions are slow: they run after the sync instead of delaying it.
  void prefetchLookups(db).catch((error: unknown) =>
    console.error("[slack]", error)
  )
  loop.status.githubIntervalS = pollInterval
  return syncInterval(pollInterval, preferences.syncIntervalSeconds)
}

/** The wait before the next sync: the chosen one, never shorter than GitHub allows. */
export function syncInterval(
  githubIntervalS: number,
  chosenS: number | null
): number {
  return Math.max(MIN_INTERVAL_S, githubIntervalS, chosenS ?? 0)
}

/** Moves the waiting sync to the new interval, counted from the last one. */
export async function rescheduleSync() {
  const loop = state()
  if (loop.current || !loop.status.lastSyncAt) return
  const preferences = await getPreferences(await getDb())
  const wait = syncInterval(
    loop.status.githubIntervalS ?? MIN_INTERVAL_S,
    preferences.syncIntervalSeconds
  )
  const elapsed = (Date.now() - Date.parse(loop.status.lastSyncAt)) / 1000
  schedule(Math.max(1, wait - elapsed))
}

function schedule(seconds: number) {
  const loop = state()
  if (loop.timer) clearTimeout(loop.timer)
  loop.status.nextSyncAt = new Date(Date.now() + seconds * 1000).toISOString()
  loop.timer = setTimeout(() => void syncNow(), seconds * 1000)
  // The next sync must not keep the process alive once the server stops.
  loop.timer.unref()
}

/** Runs a sync now, or joins the one in progress, then reschedules the next one. */
export function syncNow(
  options: { forceSearch?: boolean } = {}
): Promise<void> {
  const loop = state()
  if (loop.current) return loop.current
  loop.status.running = true
  loop.current = runOnce(options.forceSearch ?? false)
    .then((interval) => {
      loop.status.lastSyncAt = new Date().toISOString()
      loop.status.lastError = null
      schedule(interval)
    })
    .catch((error: unknown) => {
      console.error("[sync]", error)
      loop.status.lastError =
        error instanceof Error ? error.message : String(error)
      schedule(120)
    })
    .finally(() => {
      loop.status.running = false
      loop.current = null
    })
  return loop.current
}

/** Starts the background loop once per server process. */
export function ensureSyncLoop() {
  const loop = state()
  if (!loop.timer && !loop.current) void syncNow({ forceSearch: true })
}

export function getSyncStatus(): SyncStatus {
  return { ...state().status }
}
