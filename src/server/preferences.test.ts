import { beforeEach, describe, expect, it } from "vitest"
import {
  getPreferences,
  channelIdOf,
  doNotDisturb,
  normalizeChannel,
  resolveExclusions,
  preferencesPatchSchema,
  updatePreferences,
  withoutExcludedChannels,
} from "./preferences"
import { createDatabase } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import { getAgentConfig } from "@/server/agents/runner"

const thread = (channel: string) => ({
  channel,
  // One channel id per name, as Slack gives each channel its own.
  permalink: `https://acme.slack.com/archives/C${channel.replace(/\W/g, "").toUpperCase()}/p1`,
  match: "link" as const,
  messages: [],
})

describe("preferences", () => {
  let db: Database

  beforeEach(async () => {
    db = await createDatabase()
  })

  it("starts from the defaults", async () => {
    expect(await getPreferences(db)).toEqual({
      slackExcludedChannels: [],
      slackAutoSearch: true,
      reviewNoticeEnabled: true,
      reviewNoticeChannel: "pull-requests",
      agentCli: null,
      agentModel: null,
      summaryModel: null,
      summaryLength: "short",
      notifyEnabled: true,
      notifyKinds: ["review", "awaiting", "changes", "ci", "recap"],
      reviewCommands: ["@codex review", "@claude review", "/gemini review"],
      autoDoneClosed: true,
      autoDoneBots: true,
      autoDoneCi: true,
      autoDoneReleases: true,
      autoDoneAuthors: [],
      recapEnabled: true,
      recapTime: "09:05",
      standupEnabled: true,
      myStandupEnabled: true,
      teamStaleDays: 7,
      reviewSlaHours: 24,
      sprintProject: null,
      syncIntervalSeconds: null,
      dndUntil: null,
      quietHoursEnabled: false,
      quietStart: "19:00",
      quietEnd: "09:00",
    })
  })

  it("normalises channels and keeps untouched options on partial updates", async () => {
    await updatePreferences(db, {
      slackExcludedChannels: [
        "#Tech-Team-General",
        "tech-team-general",
        " #random ",
      ],
    })
    await updatePreferences(
      db,
      preferencesPatchSchema.parse({ agentCli: "codex" })
    )
    expect(await getPreferences(db)).toMatchObject({
      slackExcludedChannels: ["random", "tech-team-general"],
      agentCli: "codex",
    })
  })
})

describe("withoutExcludedChannels", () => {
  it("hides threads from excluded channels whatever their spelling", () => {
    expect(normalizeChannel(" #Tech-Team-General")).toBe("tech-team-general")
    const visible = withoutExcludedChannels(
      [thread("#tech-team-general"), thread("#pull-requests")],
      ["tech-team-general"]
    )
    expect(visible.map((t) => t.channel)).toEqual(["#pull-requests"])
  })
})

describe("channel ids", () => {
  const dm = (channel: string, ts: string) => ({
    channel,
    permalink: `https://acme.slack.com/archives/D01ABCD2EFG/p${ts}`,
    match: "link" as const,
    messages: [],
  })

  it("reads the channel id from the permalink", () => {
    expect(channelIdOf("https://acme.slack.com/archives/D01ABCD2EFG/p1")).toBe(
      "d01abcd2efg"
    )
    expect(channelIdOf("https://example.com/thread")).toBeNull()
  })

  it("hides a DM under every name the agent gives it, from one excluded name", () => {
    const hidden = resolveExclusions(
      ["dm github (bot) / alexandre da costa"],
      [dm("#dm github (bot) / alexandre da costa", "1")]
    )
    const visible = withoutExcludedChannels(
      [
        dm("#dm (github bot ↔ alexandre da costa)", "2"),
        thread("#pull-requests"),
      ],
      hidden
    )
    expect(visible.map((t) => t.channel)).toEqual(["#pull-requests"])
  })

  it("accepts a channel id as an exclusion", () => {
    const visible = withoutExcludedChannels(
      [dm("#dm with github", "3")],
      ["D01ABCD2EFG"]
    )
    expect(visible).toEqual([])
  })
})

describe("getAgentConfig overrides", () => {
  it("lets the settings page pick the agent and model over .env", () => {
    const env = {
      AGENT_CLI: "claude",
      AGENT_MODEL: "opus",
      AGENT_COMMAND: "/bin/claude",
    }
    expect(getAgentConfig(env, {})).toEqual({
      kind: "claude",
      command: "/bin/claude",
      model: "opus",
    })
    // The .env model and command belong to Claude, not to Codex.
    expect(getAgentConfig(env, { agentCli: "codex" })).toEqual({
      kind: "codex",
      command: "codex",
      model: undefined,
    })
    expect(getAgentConfig(env, { agentModel: "sonnet" }).model).toBe("sonnet")
  })
})

describe("triage preferences", () => {
  let db: Database

  beforeEach(async () => {
    db = await createDatabase()
  })

  it("normalises the logins of the authors to file away", async () => {
    const next = await updatePreferences(db, {
      autoDoneAuthors: ["@Release-Bot", "release-bot", "ci-user"],
    })
    expect(next.autoDoneAuthors).toEqual(["ci-user", "release-bot"])
  })

  it("rejects an invalid recap time", async () => {
    await expect(
      updatePreferences(db, { recapTime: "25:00" })
    ).rejects.toThrow()
  })
})

describe("doNotDisturb", () => {
  const off = {
    dndUntil: null,
    quietHoursEnabled: false,
    quietStart: "19:00",
    quietEnd: "09:00",
  }
  const at = (time: string) => new Date(`2026-10-13T${time}:00`)

  it("mutes until « Ne pas déranger » ends", () => {
    const until = { ...off, dndUntil: at("15:00").toISOString() }
    expect(doNotDisturb(until, at("14:59"))).toEqual({
      muted: true,
      reason: "dnd",
    })
    expect(doNotDisturb(until, at("15:00")).muted).toBe(false)
  })

  it("mutes the quiet hours, across midnight or within a day", () => {
    const night = { ...off, quietHoursEnabled: true }
    expect(doNotDisturb(night, at("22:30")).reason).toBe("quiet")
    expect(doNotDisturb(night, at("08:59")).muted).toBe(true)
    expect(doNotDisturb(night, at("09:00")).muted).toBe(false)
    const lunch = { ...night, quietStart: "12:00", quietEnd: "13:30" }
    expect(doNotDisturb(lunch, at("12:45")).muted).toBe(true)
    expect(doNotDisturb(lunch, at("14:00")).muted).toBe(false)
  })
})
