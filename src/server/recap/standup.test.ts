import { describe, expect, it } from "vitest"
import { commandInstructions, parseStandup, publishBlocker } from "./standup"
import type { StandupState } from "./standup"

describe("parseStandup", () => {
  it("keeps both forms of the message and the reminder thread", () => {
    expect(
      parseStandup({
        message: " **Point équipe** ",
        slackMessage: "<@U1> : livré",
        channelId: "C08P7R8BLCA",
        threadTs: "1791800000.000100",
        alreadyPosted: false,
        note: "",
      })
    ).toEqual({
      message: "**Point équipe**",
      slackMessage: "<@U1> : livré",
      channelId: "C08P7R8BLCA",
      threadTs: "1791800000.000100",
      alreadyPosted: false,
      note: null,
    })
  })

  it("rejects an answer without a message", () => {
    expect(() => parseStandup({ slackMessage: null })).toThrow()
  })
})

describe("publishBlocker", () => {
  const ready: StandupState = {
    status: "done",
    date: "2026-10-12",
    startedAt: null,
    finishedAt: null,
    message: "**Point équipe**",
    slackMessage: "<@U1> : livré",
    channelId: "C1",
    threadTs: "1.2",
    alreadyPosted: false,
    postedAt: null,
    postedLink: null,
    note: null,
    error: null,
  }

  it("allows a fresh standup with a thread", () => {
    expect(publishBlocker(ready, "team")).toBeNull()
  })

  it("refuses without a thread, twice, or when the thread has one", () => {
    expect(publishBlocker({ ...ready, threadTs: null }, "team")).toMatch(
      /reminder/
    )
    expect(publishBlocker({ ...ready, postedAt: "now" }, "team")).toMatch(
      /déjà publié/
    )
    expect(publishBlocker({ ...ready, alreadyPosted: true }, "team")).toMatch(
      /point d'équipe/
    )
    expect(publishBlocker({ ...ready, alreadyPosted: true }, "me")).toMatch(
      /Ton standup est déjà/
    )
    expect(publishBlocker({ ...ready, slackMessage: null }, "team")).toMatch(
      /relance/
    )
    expect(
      publishBlocker({ ...ready, message: null, slackMessage: null }, "team")
    ).toMatch(/Aucun/)
  })
})

describe("commandInstructions", () => {
  it("keeps the command's text without its frontmatter or arguments", () => {
    expect(
      commandInstructions(
        "---\ndescription: Team standup\n---\nExport the board.$ARGUMENTS\n"
      )
    ).toBe("Export the board.")
  })
})
