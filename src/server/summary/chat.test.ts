import { describe, expect, it } from "vitest"
import {
  buildChatInput,
  formatDiff,
  formatItemFacts,
  parseChatAnswer,
} from "./chat"
import { INSIGHTS } from "@/lib/insights"

const file = (filename: string, patch: string) => ({
  filename,
  previousFilename: null,
  status: "modified",
  additions: 1,
  deletions: 0,
  patch,
  url: "",
  viewed: "UNVIEWED" as const,
})

describe("formatDiff", () => {
  it("keeps whole files until the budget runs out, and says what it left out", () => {
    const diff = formatDiff(
      [file("a.ts", "+a"), file("b.ts", "+".repeat(100)), file("c.ts", "+c")],
      60
    )
    expect(diff).toContain("--- a.ts")
    expect(diff).toContain("--- c.ts")
    expect(diff).not.toContain("--- b.ts")
    expect(diff).toContain("(1 more file left out for size)")
  })
})

describe("buildChatInput", () => {
  it("puts the context, the diff, the earlier exchanges, then the question", () => {
    const input = buildChatInput(
      "# Pull request acme/app#1",
      "- on uat: yes",
      "--- a.ts",
      [
        { role: "user", content: "Qui bloque ?", at: "" },
        { role: "assistant", content: "@lead", at: "" },
      ],
      "Pourquoi ?"
    )
    expect(input.indexOf("## Facts")).toBeLessThan(input.indexOf("## Diff"))
    expect(input.indexOf("## Diff")).toBeLessThan(
      input.indexOf("## Earlier exchanges")
    )
    expect(input).toContain("Question: Qui bloque ?\nAnswer: @lead")
    expect(input.endsWith("## Question\nPourquoi ?")).toBe(true)
  })
})

describe("formatItemFacts", () => {
  it("gives the project card, the uat state and Jev's KPIs in words", () => {
    expect(
      formatItemFacts({
        insights: [
          { id: "risk", level: 1, value: 1.2, confidence: 0.9 },
          { id: "breaking", level: 1, value: 0.7, confidence: 0.3 },
        ],
        specs: INSIGHTS,
        project: {
          title: "Roadmap",
          status: "🔍 Review",
          priority: "P1",
          via: 7,
        },
        uat: {
          state: "partial",
          shipped: 1,
          total: 2,
          at: null,
          outdated: [],
          missing: ["fix: review"],
        },
      })
    ).toBe(
      [
        "- Project « Roadmap » (card of issue #7, which it closes): status 🔍 Review, priority P1",
        "- on uat: partly, 1 of 2 commits · missing: fix: review",
        "- Jev's KPIs:",
        "  - Risque en prod: Modéré",
        "  - Changement cassant: Oui (Jev is unsure)",
      ].join("\n")
    )
  })

  it("gives nothing when the app knows nothing more", () => {
    expect(
      formatItemFacts({
        insights: [],
        specs: INSIGHTS,
        project: null,
        uat: null,
      })
    ).toBeNull()
  })
})

describe("parseChatAnswer", () => {
  it("rejects an empty answer", () => {
    expect(parseChatAnswer({ answer: " Oui. " })).toBe("Oui.")
    expect(() => parseChatAnswer({ answer: "" })).toThrow()
  })
})
