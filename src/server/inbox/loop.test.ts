import { describe, expect, it } from "vitest"
import { syncInterval } from "./loop"

describe("syncInterval", () => {
  it("waits the chosen time, never less than GitHub allows", () => {
    expect(syncInterval(60, null)).toBe(60)
    expect(syncInterval(60, 300)).toBe(300)
    expect(syncInterval(60, 30)).toBe(60)
    expect(syncInterval(10, null)).toBe(30)
  })
})
