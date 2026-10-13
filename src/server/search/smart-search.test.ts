import { describe, expect, it } from "vitest"
import { buildSearchInput, parseSearchAnswer } from "./smart-search"

describe("buildSearchInput", () => {
  it("lists each item with its facts, summary and description", () => {
    const input = buildSearchInput("la PR sur les frais de port", [
      {
        key: "acme/api#1",
        title: "fix(shipping): round the fees",
        author: "jdoe",
        labels: ["bug"],
        facts: ["brouillon"],
        body: "branch: fix/fees. Rounds them up.",
        summary: "Arrondit les frais de port.",
      },
    ])
    expect(input).toContain("## Search\nla PR sur les frais de port")
    expect(input).toContain("### acme/api#1 — fix(shipping): round the fees")
    expect(input).toContain("author: jdoe · labels: bug · brouillon")
    expect(input).toContain("Summary: Arrondit les frais de port.")
    expect(input).toContain("branch: fix/fees. Rounds them up.")
  })
})

describe("parseSearchAnswer", () => {
  it("keeps the known keys once, in Claude's order", () => {
    expect(
      parseSearchAnswer(
        {
          matches: [
            { key: "b", reason: "frais" },
            { key: "ghost", reason: "?" },
            { key: "a", reason: "port" },
            { key: "b", reason: "encore" },
          ],
        },
        new Set(["a", "b"])
      )
    ).toEqual([
      { key: "b", reason: "frais" },
      { key: "a", reason: "port" },
    ])
  })
})
