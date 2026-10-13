import { describe, expect, it } from "vitest"
import { jevScore, jevUrgencyLabel } from "./jev-gauge"
import { messagesFor } from "@/lib/i18n/messages"
import { URGENCY_LEVELS } from "@/server/inbox/priority"

describe("jevScore", () => {
  it("spreads Jev's four levels over the 0–100 gauge", () => {
    expect([0, 1, 2, 3].map(jevScore)).toEqual([0, 33, 67, 100])
    expect(jevScore(2.4)).toBe(80)
  })
})

describe("jevUrgencyLabel", () => {
  it("names the urgency in the chosen language, within the scale", () => {
    expect(jevUrgencyLabel(1.2, messagesFor("fr"))).toBe("normale")
    expect(jevUrgencyLabel(3, messagesFor("en"))).toBe("blocking or urgent")
    expect(jevUrgencyLabel(7, messagesFor("en"))).toBe("blocking or urgent")
  })

  it("has one label per level of Jev's rubric in each language", () => {
    for (const language of ["fr", "en"] as const)
      expect(messagesFor(language).pull.jev.urgencyLevels).toHaveLength(
        URGENCY_LEVELS.length
      )
  })
})
