import { describe, expect, it } from "vitest"
import { demoAvatar, pullSize } from "./format"

describe("pullSize", () => {
  it("buckets changed lines", () => {
    expect(pullSize(8, 2)).toBe("XS")
    expect(pullSize(80, 20)).toBe("S")
    expect(pullSize(300, null)).toBe("M")
    expect(pullSize(900, 100)).toBe("L")
    expect(pullSize(1000, 1)).toBe("XL")
  })
})

describe("demoAvatar", () => {
  it("draws initials locally, the same color for the same login", () => {
    const avatar = demoAvatar("jane-doe")
    expect(avatar.startsWith("data:image/svg+xml,")).toBe(true)
    expect(decodeURIComponent(avatar)).toContain(">JD</text>")
    expect(demoAvatar("jane-doe")).toBe(avatar)
    expect(decodeURIComponent(demoAvatar("renovate[bot]"))).toContain(
      ">R</text>"
    )
  })
})
