import { describe, expect, it } from "vitest"
import { jevScore } from "./jev-gauge"

describe("jevScore", () => {
  it("spreads Jev's four levels over the 0–100 gauge", () => {
    expect([0, 1, 2, 3].map(jevScore)).toEqual([0, 33, 67, 100])
    expect(jevScore(2.4)).toBe(80)
  })
})
