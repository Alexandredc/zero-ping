import { describe, expect, it } from "vitest"
import { readinessText } from "./readiness"
import { messagesFor } from "@/lib/i18n/messages"
import type { Readiness } from "@/server/readiness/rules"

const fr = messagesFor("fr")
const en = messagesFor("en")

describe("readinessText", () => {
  it("says a PR is ready", () => {
    const ready: Readiness = { status: "ready", gaps: [], waitHash: null }
    expect(readinessText(ready, fr)).toBe("Prête à merger")
    expect(readinessText(ready, en)).toBe("Ready to merge")
  })

  it("lists what is missing, in both languages", () => {
    const almost: Readiness = {
      status: "almost",
      gaps: [
        { kind: "behind" },
        { kind: "threads", count: 2 },
        { kind: "commit-after-approval" },
        { kind: "wait", reason: "dependency", pull: 10569 },
      ],
      waitHash: null,
    }
    expect(readinessText(almost, fr)).toBe(
      "Presque : à rebaser, 2 fils ouverts, commit après l'approbation, attend #10569"
    )
    expect(readinessText(almost, en)).toBe(
      "Almost: needs a rebase, 2 open threads, commit after the approval, waits for #10569"
    )
  })

  it("names the review state and the reason to wait", () => {
    expect(
      readinessText(
        {
          status: "almost",
          gaps: [
            { kind: "review", decision: "CHANGES_REQUESTED" },
            { kind: "threads", count: 1 },
            { kind: "wait", reason: "freeze", pull: null },
          ],
          waitHash: null,
        },
        fr
      )
    ).toBe("Presque : changements demandés, 1 fil ouvert, gel des déploiements")
  })
})
