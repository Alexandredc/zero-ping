import type { ActivitySnapshot, ItemActivity } from "@/lib/activity"

const globalForActivity = globalThis as unknown as {
  __zeroPingActivity?: Map<string, Map<ItemActivity, number>>
}
/** Item key → activity → how many runs of it are under way. */
const running = (globalForActivity.__zeroPingActivity ??= new Map())

/**
 * Records background work on an item until the returned function is called.
 * Calling it more than once ends the work once.
 */
export function beginActivity(key: string, activity: ItemActivity): () => void {
  const activities = running.get(key) ?? new Map<ItemActivity, number>()
  activities.set(activity, (activities.get(activity) ?? 0) + 1)
  running.set(key, activities)
  let ended = false
  return () => {
    if (ended) return
    ended = true
    const count = (activities.get(activity) ?? 1) - 1
    if (count > 0) activities.set(activity, count)
    else activities.delete(activity)
    if (activities.size === 0 && running.get(key) === activities)
      running.delete(key)
  }
}

/** Runs `work` as an activity of the item, ended whether it succeeds or fails. */
export async function trackActivity<T>(
  key: string,
  activity: ItemActivity,
  work: () => Promise<T>
): Promise<T> {
  const end = beginActivity(key, activity)
  try {
    return await work()
  } finally {
    end()
  }
}

/** What runs on which item right now, for the list. */
export function activitySnapshot(): ActivitySnapshot {
  return Object.fromEntries(
    [...running].map(([key, activities]) => [key, [...activities.keys()]])
  )
}
