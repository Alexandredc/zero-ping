import { describe, expect, it } from "vitest"
import { isBot, matchAutoRule } from "./auto-done"
import type { AutoDoneRules } from "./auto-done"

const rules: AutoDoneRules = {
  autoDoneClosed: true,
  autoDoneBots: true,
  autoDoneCi: true,
  autoDoneReleases: true,
  autoDoneAuthors: ["noisy-dev"],
}

const item = {
  view: "other" as const,
  awaitingMe: false,
  state: "OPEN",
  author: "dev",
  reason: "subscribed",
  subjectType: "PullRequest",
}

describe("matchAutoRule", () => {
  it("files merged and closed subjects", () => {
    expect(matchAutoRule({ ...item, state: "MERGED" }, rules)).toBe("PR mergée")
    expect(matchAutoRule({ ...item, state: "CLOSED" }, rules)).toBe("Fermée")
  })

  it("files CI runs, releases, bots and listed authors", () => {
    expect(matchAutoRule({ ...item, reason: "ci_activity" }, rules)).toBe(
      "Activité CI"
    )
    expect(matchAutoRule({ ...item, subjectType: "Release" }, rules)).toBe(
      "Release"
    )
    expect(matchAutoRule({ ...item, author: "renovate" }, rules)).toBe(
      "Bot @renovate"
    )
    expect(matchAutoRule({ ...item, author: "Noisy-Dev" }, rules)).toBe(
      "Auteur @Noisy-Dev"
    )
  })

  it("never files what waits for the viewer", () => {
    expect(
      matchAutoRule({ ...item, view: "review", state: "MERGED" }, rules)
    ).toBeNull()
    expect(
      matchAutoRule({ ...item, awaitingMe: true, author: "renovate" }, rules)
    ).toBeNull()
  })

  it("respects disabled rules", () => {
    expect(
      matchAutoRule(
        { ...item, state: "MERGED" },
        { ...rules, autoDoneClosed: false }
      )
    ).toBeNull()
    expect(matchAutoRule(item, rules)).toBeNull()
  })
})

describe("isBot", () => {
  it("recognises REST and GraphQL bot logins", () => {
    expect(isBot("dependabot[bot]")).toBe(true)
    expect(isBot("dependabot")).toBe(true)
    expect(isBot("lead")).toBe(false)
    expect(isBot(null)).toBe(false)
  })
})
