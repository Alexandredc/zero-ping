import { getDb } from "@/server/db/client"
import { getOctokit, getViewer } from "@/server/github/client"
import {
  enrichItems,
  pollNotifications,
  rescoreAll,
  searchReviewRequests,
} from "@/server/inbox/sync"

export type SyncStatus = {
  running: boolean
  lastSyncAt: string | null
  lastError: string | null
  nextSyncAt: string | null
}

type LoopState = {
  status: SyncStatus
  timer: ReturnType<typeof setTimeout> | null
  current: Promise<void> | null
}

const MIN_INTERVAL_S = 30

const globalForLoop = globalThis as unknown as { __githubInboxLoop?: LoopState }

function state(): LoopState {
  globalForLoop.__githubInboxLoop ??= {
    status: {
      running: false,
      lastSyncAt: null,
      lastError: null,
      nextSyncAt: null,
    },
    timer: null,
    current: null,
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
  await searchReviewRequests(db, octokit, forceSearch)
  await enrichItems(db, octokit, viewer)
  await rescoreAll(db)
  return Math.max(MIN_INTERVAL_S, pollInterval)
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
