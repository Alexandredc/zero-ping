import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  commandInstructions,
  parseStandup,
  publishBlocker,
  standupCommand,
  standupJsonSchema,
  standupSetupBlocker,
  standupSystemPrompt,
} from "./standup"
import type { StandupState } from "./standup"
import { messagesFor } from "@/lib/i18n/messages"

const fr = messagesFor("fr")
const en = messagesFor("en")

describe("parseStandup", () => {
  it("keeps both forms of the message and the reminder thread", () => {
    expect(
      parseStandup(
        {
          message: " **Point équipe** ",
          slackMessage: "<@U1> : livré",
          channelId: "C0123456789",
          threadTs: "1791800000.000100",
          alreadyPosted: false,
          note: "",
        },
        fr
      )
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
    expect(() => parseStandup({ slackMessage: null }, en)).toThrow(
      "The standup returned no message."
    )
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
    // 2026-10-12 at 09:00 local time.
    threadTs: String(new Date(2026, 9, 12, 9).getTime() / 1000),
    alreadyPosted: false,
    postedAt: null,
    postedLink: null,
    note: null,
    error: null,
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(2026, 9, 12, 10) })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows a fresh standup with a thread", () => {
    expect(publishBlocker(ready, "team")).toBeNull()
  })

  it("refuses another day's reminder thread", () => {
    vi.setSystemTime(new Date(2026, 9, 13, 10))
    expect(publishBlocker(ready, "team")).toMatch(/autre jour/)
    expect(publishBlocker(ready, "team", en, "2026-10-12")).toBeNull()
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

  it("words the blockers in the chosen language", () => {
    expect(publishBlocker({ ...ready, postedAt: "now" }, "team", en)).toBe(
      "This standup is already posted."
    )
    expect(publishBlocker({ ...ready, alreadyPosted: true }, "me", en)).toBe(
      "Your standup is already in today's thread."
    )
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
    const prompt = standupSystemPrompt("me", settings, "2026-10-16")
    expect(prompt).toContain(
      'today\'s "Daily standup reminder" message in #eng-daily'
    )
    expect(prompt).toContain("Today is 2026-10-16")
  })

  it("asks for a channel before any run", () => {
    expect(standupSetupBlocker(settings, fr)).toBeNull()
    expect(
      standupSetupBlocker({ ...settings, standupChannel: "" }, fr)
    ).toMatch(/Réglages > Récap/)
    expect(
      standupSetupBlocker({ ...settings, standupChannel: "" }, en)
    ).toMatch(/Settings > Recap/)
  })

  it("asks for the note in the chosen language", () => {
    expect(standupJsonSchema("me", "en").properties.note.description).toMatch(
      /^In English, one sentence/
    )
    expect(standupJsonSchema("team", "fr").properties.note.description).toMatch(
      /^In French, one sentence/
    )
  })
})
