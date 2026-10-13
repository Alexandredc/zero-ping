import { describe, expect, it } from "vitest"
import { recapLine } from "./recap"
import { messagesFor } from "@/lib/i18n/messages"

const fr = messagesFor("fr")
const en = messagesFor("en")

const none = { review: 0, awaiting: 0, ciFailing: 0, readyToMerge: 0, team: 0 }

describe("recapLine", () => {
  it("lists only what waits, with French plurals", () => {
    expect(
      recapLine({ ...none, review: 3, awaiting: 1, ciFailing: 2 }, fr)
    ).toBe("3 reviews, 1 réponse attendue, 2 CI rouges")
  })

  it("writes English plurals", () => {
    expect(
      recapLine({ ...none, review: 1, readyToMerge: 2, team: 1 }, en)
    ).toBe("1 review, 2 PRs to merge, 1 blocked team PR")
  })

  it("says so when nothing waits", () => {
    expect(recapLine(none, fr)).toBe("Rien ne t'attend ce matin.")
    expect(recapLine(none, en)).toBe("Nothing is waiting for you this morning.")
  })
})
