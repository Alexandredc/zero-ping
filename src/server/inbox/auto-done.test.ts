import { messagesFor } from "@/lib/i18n/messages"
import { describe, expect, it } from "vitest"
import { isBot, matchAutoRule } from "./auto-done"
import type { AutoDoneRules } from "./auto-done"

const fr = messagesFor("fr")

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
    expect(matchAutoRule({ ...item, state: "MERGED" }, rules, fr)).toBe(
      "PR mergée"
    )
    expect(matchAutoRule({ ...item, state: "CLOSED" }, rules, fr)).toBe(
      "Fermée"
    )
  })

  it("files CI runs, releases, bots and listed authors", () => {
    expect(matchAutoRule({ ...item, reason: "ci_activity" }, rules, fr)).toBe(
      "Activité CI"
    )
    expect(matchAutoRule({ ...item, subjectType: "Release" }, rules, fr)).toBe(
      "Release"
    )
    expect(matchAutoRule({ ...item, author: "renovate" }, rules, fr)).toBe(
      "Bot @renovate"
    )
    expect(matchAutoRule({ ...item, author: "Noisy-Dev" }, rules, fr)).toBe(
      "Auteur @Noisy-Dev"
    )
  })

  it("never files what waits for the viewer", () => {
    expect(
      matchAutoRule({ ...item, view: "review", state: "MERGED" }, rules, fr)
    ).toBeNull()
    expect(
      matchAutoRule(
        { ...item, awaitingMe: true, author: "renovate" },
        rules,
        fr
      )
    ).toBeNull()
  })

  it("respects disabled rules", () => {
    expect(
      matchAutoRule(
        { ...item, state: "MERGED" },
        { ...rules, autoDoneClosed: false },
        fr
      )
    ).toBeNull()
    expect(matchAutoRule(item, rules, fr)).toBeNull()
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

describe("matchAutoRule in English", () => {
  it("labels the rule in the chosen language", () => {
    const en = messagesFor("en")
    expect(matchAutoRule({ ...item, state: "MERGED" }, rules, en)).toBe(
      "PR merged"
    )
    expect(matchAutoRule({ ...item, author: "Noisy-Dev" }, rules, en)).toBe(
      "Author @Noisy-Dev"
    )
  })
})
