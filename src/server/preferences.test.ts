import { beforeEach, describe, expect, it } from "vitest"
import {
  getPreferences,
  normalizeChannel,
  preferencesPatchSchema,
  updatePreferences,
  withoutExcludedChannels,
} from "./preferences"
import { createDatabase } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import { getAgentConfig } from "@/server/agents/runner"

const thread = (channel: string) => ({
  channel,
  permalink: `https://acme.slack.com/archives/C1/p${channel.length}`,
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
      teamStaleDays: 7,
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
