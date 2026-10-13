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
    expect(insertMention("Merci @ma pour", 6, 9, "teammate")).toEqual({
      value: "Merci @teammate pour",
      caret: 17,
    })
    expect(insertMention("Merci @ma", 6, 9, "teammate")).toEqual({
      value: "Merci @teammate ",
      caret: 17,
    })
  })
})

describe("rankMentions", () => {
  it("puts login prefixes first, then first-name prefixes", () => {
    const people = [
      { login: "dupont-jean", name: "Jean Dupont" },
      { login: "teammate", name: "Robin G" },
      { login: "lena-lopez", name: "Lena Lopez" },
    ]
    expect(rankMentions(people, "ro").map((p) => p.login)).toEqual([
      "dupont-jean",
    ])
    expect(rankMentions(people, "lo").map((p) => p.login)).toEqual(["lena-lopez"])
    expect(rankMentions(people, "").length).toBe(3)
  })
})
