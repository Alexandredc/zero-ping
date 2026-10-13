import { describe, expect, it } from "vitest"
import { buildChatInput, formatDiff, parseChatAnswer } from "./chat"

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
      "--- a.ts",
      [
        { role: "user", content: "Qui bloque ?", at: "" },
        { role: "assistant", content: "@lead", at: "" },
      ],
      "Pourquoi ?"
    )
    expect(input.indexOf("## Diff")).toBeLessThan(
      input.indexOf("## Earlier exchanges")
    )
    expect(input).toContain("Question: Qui bloque ?\nAnswer: @lead")
    expect(input.endsWith("## Question\nPourquoi ?")).toBe(true)
  })
})

describe("parseChatAnswer", () => {
  it("rejects an empty answer", () => {
    expect(parseChatAnswer({ answer: " Oui. " })).toBe("Oui.")
    expect(() => parseChatAnswer({ answer: "" })).toThrow()
  })
})
