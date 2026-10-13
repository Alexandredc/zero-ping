import { describe, expect, it } from "vitest"
import { demoAvatar, elapsed, formatWhen, pullSize, timeAgo } from "./format"

describe("pullSize", () => {
  it("buckets changed lines", () => {
    expect(pullSize(8, 2)).toBe("XS")
    expect(pullSize(80, 20)).toBe("S")
    expect(pullSize(300, null)).toBe("M")
    expect(pullSize(900, 100)).toBe("L")
    expect(pullSize(1000, 1)).toBe("XL")
  })
})

/** Intl separates numbers and units with no-break spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, " ")

describe("timeAgo", () => {
  const now = new Date("2026-10-13T12:00:00")

  it("speaks the chosen language", () => {
    const threeDays = new Date("2026-10-10T12:00:00")
    expect(plain(timeAgo(threeDays, "fr", now))).toBe("il y a 3 j")
    expect(plain(timeAgo(threeDays, "en", now))).toBe("3 days ago")
  })

  it("says just now under a minute", () => {
    const soon = new Date("2026-10-13T11:59:40")
    expect(plain(timeAgo(soon, "fr", now))).toBe("à l'instant")
    expect(plain(timeAgo(soon, "en", now))).toBe("just now")
  })

  it("defaults to French", () => {
    expect(
      plain(timeAgo(new Date("2026-10-13T10:00:00"), undefined, now))
    ).toBe("il y a 2 h")
  })
})

describe("elapsed", () => {
  it("drops the words around the duration", () => {
    const now = new Date("2026-10-13T12:00:00")
    const date = new Date("2026-10-10T12:00:00")
    expect(plain(elapsed(date, "fr", now))).toBe("3 j")
    expect(plain(elapsed(date, "en", now))).toBe("3 days")
  })
})

describe("formatWhen", () => {
  const now = new Date("2026-10-13T08:00:00")

  it("names today and tomorrow", () => {
    expect(plain(formatWhen(new Date("2026-10-13T17:30:00"), "fr", now))).toBe(
      "aujourd'hui 17:30"
    )
    expect(
      plain(formatWhen(new Date("2026-10-14T09:00:00"), "en", now))
    ).toMatch(/^tomorrow 09:00/)
  })

  it("writes later days in the chosen language", () => {
    const later = new Date("2026-10-20T09:00:00")
    expect(plain(formatWhen(later, "fr", now))).toBe("mar. 20 oct. 09:00")
    expect(plain(formatWhen(later, "en", now))).toMatch(/^Tue, Oct 20 09:00/)
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
