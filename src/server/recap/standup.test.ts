import { describe, expect, it } from "vitest"
import { parseStandup } from "./standup"

describe("parseStandup", () => {
  it("keeps the message, the draft link and the note", () => {
    expect(
      parseStandup({
        message: " **Point équipe** ",
        draftLink: "https://slack.com/archives/C1/p2",
        note: "",
      })
    ).toEqual({
      message: "**Point équipe**",
      draftLink: "https://slack.com/archives/C1/p2",
      note: null,
    })
  })

  it("rejects an answer without a message", () => {
    expect(() => parseStandup({ draftLink: null })).toThrow()
  })
})
