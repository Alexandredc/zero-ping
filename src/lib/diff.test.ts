import { describe, expect, it } from "vitest"
import { parsePatch } from "./diff"

describe("parsePatch", () => {
  it("numbers context, removed and added lines on each side", () => {
    const patch = [
      "@@ -10,3 +10,4 @@ export function retry() {",
      " const max = 3",
      "-const delay = 100",
      "+const delay = 250",
      "+const jitter = true",
      " return run()",
      "\\ No newline at end of file",
    ].join("\n")
    expect(parsePatch(patch)).toEqual([
      { kind: "hunk", text: "@@ -10,3 +10,4 @@ export function retry() {" },
      { kind: "context", text: "const max = 3", oldLine: 10, newLine: 10 },
      { kind: "del", text: "const delay = 100", oldLine: 11, newLine: null },
      { kind: "add", text: "const delay = 250", oldLine: null, newLine: 11 },
      { kind: "add", text: "const jitter = true", oldLine: null, newLine: 12 },
      { kind: "context", text: "return run()", oldLine: 12, newLine: 13 },
    ])
  })

  it("restarts numbering at each hunk", () => {
    const lines = parsePatch("@@ -1 +1 @@\n-a\n+b\n@@ -40,2 +40,2 @@\n x")
    expect(lines.at(-1)).toEqual({
      kind: "context",
      text: "x",
      oldLine: 40,
      newLine: 40,
    })
  })
})
