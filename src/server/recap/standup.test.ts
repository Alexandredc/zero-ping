import { describe, expect, it } from "vitest"
import {
  commandInstructions,
  parseStandup,
  publishBlocker,
  standupCommand,
  standupSetupBlocker,
  standupSystemPrompt,
} from "./standup"
import type { StandupState } from "./standup"

describe("parseStandup", () => {
  it("keeps both forms of the message and the reminder thread", () => {
    expect(
      parseStandup({
        message: " **Point équipe** ",
        slackMessage: "<@U1> : livré",
        channelId: "C0123456789",
        threadTs: "1791800000.000100",
        alreadyPosted: false,
        note: "",
      })
    ).toEqual({
      message: "**Point équipe**",
      slackMessage: "<@U1> : livré",
      channelId: "C0123456789",
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

describe("standup settings", () => {
  const settings = {
    standupChannel: "eng-daily",
    standupReminder: "Daily standup reminder",
    teamStandupCommand: "/standup:team",
    myStandupCommand: "/standup",
  }

  it("runs the command chosen for each standup", () => {
    expect(standupCommand("team", settings)).toBe("/standup:team")
    expect(standupCommand("me", settings)).toBe("/standup")
  })

  it("points the agent at the configured channel and reminder", () => {
    const prompt = standupSystemPrompt("me", settings)
    expect(prompt).toContain(
      'today\'s "Daily standup reminder" message in #eng-daily'
    )
  })

  it("asks for a channel before any run", () => {
    expect(standupSetupBlocker(settings)).toBeNull()
    expect(standupSetupBlocker({ ...settings, standupChannel: "" })).toMatch(
      /Réglages > Récap/
    )
  })
})
