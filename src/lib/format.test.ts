import { describe, expect, it } from "vitest"
import { pullSize } from "./format"

describe("pullSize", () => {
  it("buckets changed lines", () => {
    expect(pullSize(8, 2)).toBe("XS")
    expect(pullSize(80, 20)).toBe("S")
    expect(pullSize(300, null)).toBe("M")
    expect(pullSize(900, 100)).toBe("L")
    expect(pullSize(1000, 1)).toBe("XL")
  })
})
