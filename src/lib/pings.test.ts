import { describe, expect, it } from "vitest"
import { badgedLogo, formatPings, pageTitle } from "./pings"

describe("pings", () => {
  it("caps the count at 99+", () => {
    expect(formatPings(7)).toBe("7")
    expect(formatPings(120)).toBe("99+")
  })

  it("prefixes the page title and drops the prefix at zero", () => {
    expect(pageTitle("Zéro Ping", 3)).toBe("(3) Zéro Ping")
    expect(pageTitle("(3) Zéro Ping", 5)).toBe("(5) Zéro Ping")
    expect(pageTitle("(99+) Zéro Ping", 0)).toBe("Zéro Ping")
  })

  it("adds a badge to the logo only when something is waiting", () => {
    const logo = '<svg viewBox="0 0 32 32"><rect/></svg>'
    expect(badgedLogo(logo, 0)).toBe(logo)
    const badged = badgedLogo(logo, 12)
    expect(badged).toContain(">12</text></svg>")
    expect(badged.startsWith('<svg viewBox="0 0 32 32"><rect/>')).toBe(true)
  })
})
