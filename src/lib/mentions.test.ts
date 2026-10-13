import { describe, expect, it } from "vitest"
import { insertMention, mentionQueryAt, rankMentions } from "./mentions"

describe("mentionQueryAt", () => {
  it("finds the @word before the caret, not inside an email", () => {
    expect(mentionQueryAt("Merci @mat", 10)).toEqual({ start: 6, query: "mat" })
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" })
    expect(mentionQueryAt("dev@acme", 8)).toBeNull()
    expect(mentionQueryAt("Merci @mat et", 13)).toBeNull()
  })
})

describe("insertMention", () => {
  it("replaces the typed word and puts the caret after the mention", () => {
    expect(insertMention("Merci @ma pour", 6, 9, "jdoe")).toEqual({
      value: "Merci @jdoe pour",
      caret: 12,
    })
    expect(insertMention("Merci @ma", 6, 9, "jdoe")).toEqual({
      value: "Merci @jdoe ",
      caret: 12,
    })
  })
})

describe("rankMentions", () => {
  it("puts login prefixes first, then first-name prefixes", () => {
    const people = [
      { login: "roux-paul", name: "Paul Roux" },
      { login: "jdoe", name: "Jane Doe" },
      { login: "lmartin", name: "Louise Martin" },
    ]
    expect(rankMentions(people, "ro").map((p) => p.login)).toEqual([
      "roux-paul",
    ])
    expect(rankMentions(people, "lo").map((p) => p.login)).toEqual(["lmartin"])
    expect(rankMentions(people, "").length).toBe(3)
  })
})
