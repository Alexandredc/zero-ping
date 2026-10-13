import { describe, expect, it } from "vitest"
import { checksLabel } from "./checks-indicator"
import { messagesFor } from "@/lib/i18n/messages"

const summary = (counts: {
  passed?: number
  failed?: number
  pending?: number
  skipped?: number
}) => ({
  passed: 0,
  failed: 0,
  pending: 0,
  skipped: 0,
  running: [],
  ...counts,
})

describe("checksLabel", () => {
  it("sums the checks up in French", () => {
    const t = messagesFor("fr")
    expect(checksLabel("passed", summary({ passed: 3, skipped: 1 }), t)).toBe(
      "Tous les checks passent · 3/3"
    )
    expect(checksLabel("failed", summary({ failed: 2 }), t)).toBe(
      "2 checks en échec"
    )
    expect(checksLabel("pending", summary({ pending: 1, passed: 2 }), t)).toBe(
      "Checks en cours · 1 sur 3"
    )
    expect(checksLabel("none", summary({}), t)).toBe("Aucun check")
  })

  it("sums the checks up in English", () => {
    const t = messagesFor("en")
    expect(checksLabel("failed", summary({ failed: 1 }), t)).toBe(
      "1 failing check"
    )
    expect(checksLabel("pending", summary({ pending: 1, passed: 2 }), t)).toBe(
      "Checks running · 1 of 3"
    )
  })
})
