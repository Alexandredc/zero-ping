import { describe, expect, it, vi } from "vitest"
import { createSwrCache } from "./swr"

function setup() {
  let time = 0
  const cache = createSwrCache<number>({
    freshMs: 10,
    maxAgeMs: 100,
    maxEntries: 2,
    now: () => time,
  })
  return { cache, advance: (ms: number) => (time += ms) }
}

describe("createSwrCache", () => {
  it("serves a fresh value without loading again", async () => {
    const { cache, advance } = setup()
    const loader = vi.fn().mockResolvedValue(1)
    expect(await cache.get("a", loader)).toBe(1)
    advance(5)
    expect(await cache.get("a", loader)).toBe(1)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("serves a stale value at once and refreshes it behind", async () => {
    const { cache, advance } = setup()
    await cache.get("a", () => Promise.resolve(1))
    advance(20)
    const refresh = vi.fn().mockResolvedValue(2)
    expect(await cache.get("a", refresh)).toBe(1)
    await Promise.resolve()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(await cache.get("a", refresh)).toBe(2)
  })

  it("waits for a value too old to show, and shares concurrent loads", async () => {
    const { cache, advance } = setup()
    await cache.get("a", () => Promise.resolve(1))
    advance(200)
    const loader = vi.fn().mockResolvedValue(3)
    const [first, second] = await Promise.all([
      cache.get("a", loader),
      cache.get("a", loader),
    ])
    expect([first, second]).toEqual([3, 3])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("keeps a stale value when its refresh fails", async () => {
    const { cache, advance } = setup()
    await cache.get("a", () => Promise.resolve(1))
    advance(20)
    expect(await cache.get("a", () => Promise.reject(new Error("down")))).toBe(
      1
    )
    await Promise.resolve()
    expect(await cache.get("a", () => Promise.resolve(2))).toBe(1)
  })

  it("forgets invalidated keys and the oldest beyond its size", async () => {
    const { cache } = setup()
    await cache.get("a", () => Promise.resolve(1))
    cache.invalidate("a")
    expect(await cache.get("a", () => Promise.resolve(2))).toBe(2)
    await cache.get("b", () => Promise.resolve(1))
    await cache.get("c", () => Promise.resolve(1))
    expect(await cache.get("a", () => Promise.resolve(9))).toBe(9)
  })
})
