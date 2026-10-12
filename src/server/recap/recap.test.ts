import { describe, expect, it } from "vitest"
import { recapLine } from "./recap"

const none = { review: 0, awaiting: 0, ciFailing: 0, readyToMerge: 0, team: 0 }

describe("recapLine", () => {
  it("lists only what waits, with French plurals", () => {
    expect(recapLine({ ...none, review: 3, awaiting: 1, ciFailing: 2 })).toBe(
      "3 reviews, 1 réponse attendue, 2 CI rouges"
    )
  })

  it("says so when nothing waits", () => {
    expect(recapLine(none)).toBe("Rien ne t'attend ce matin.")
  })
})
