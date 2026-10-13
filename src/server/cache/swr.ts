/**
 * Stale-while-revalidate, in the server's memory: a value younger than
 * `freshMs` is served as is; an older one up to `maxAgeMs` is served at once
 * while a background load replaces it; past that, or unknown, the caller waits
 * for the load. Concurrent loads of one key are shared.
 */
export function createSwrCache<TValue>(options: {
  freshMs: number
  maxAgeMs: number
  /** Keys kept at most, the least recently stored dropped first. */
  maxEntries?: number
  now?: () => number
}) {
  const now = options.now ?? Date.now
  const maxEntries = options.maxEntries ?? 500
  const entries = new Map<string, { value: TValue; at: number }>()
  const loading = new Map<string, Promise<TValue>>()

  const store = (key: string, value: TValue) => {
    entries.delete(key)
    entries.set(key, { value, at: now() })
    if (entries.size > maxEntries) {
      const oldest = entries.keys().next().value
      if (oldest !== undefined) entries.delete(oldest)
    }
  }

  const load = (key: string, loader: () => Promise<TValue>) => {
    const running = loading.get(key)
    if (running) return running
    const started = loader()
      .then((value) => {
        store(key, value)
        return value
      })
      .finally(() => loading.delete(key))
    loading.set(key, started)
    return started
  }

  return {
    async get(key: string, loader: () => Promise<TValue>): Promise<TValue> {
      const entry = entries.get(key)
      const age = entry ? now() - entry.at : Infinity
      if (entry && age < options.freshMs) return entry.value
      if (entry && age < options.maxAgeMs) {
        // A failed refresh keeps the stale value; the next read tries again.
        load(key, loader).catch(() => undefined)
        return entry.value
      }
      return load(key, loader)
    },
    /** Forgets a key, after a change made from the app. */
    invalidate(key: string) {
      entries.delete(key)
    },
    /** Forgets every key, when a change may touch any of them. */
    clear() {
      entries.clear()
    },
  }
}
