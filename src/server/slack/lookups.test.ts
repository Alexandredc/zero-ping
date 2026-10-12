import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { appendReply, drainLookups, requestLookup } from "./lookups"
import type { AgentRunner } from "./lookups"
import { createDatabase } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import { items, slackLookups } from "@/server/db/schema"
import type { Item } from "@/server/db/schema"
import { updatePreferences } from "@/server/preferences"

const thread = {
  channel: "#pull-requests",
  permalink: "https://acme.slack.com/archives/C1/p1",
  match: "link",
  messages: [
    { author: "Dev", text: "please review", postedAt: "2026-10-12T09:00:00Z" },
  ],
}

async function insertPull(db: Database): Promise<Item> {
  const [item] = await db
    .insert(items)
    .values({
      key: "acme/api#8",
      repoFullName: "acme/api",
      number: 8,
      kind: "PullRequest",
      title: "Add retries",
      htmlUrl: "https://github.com/acme/api/pull/8",
      reason: "review_requested",
      updatedAt: new Date(),
      view: "review",
    })
    .returning()
  return item
}

describe("requestLookup", () => {
  let db: Database

  beforeEach(async () => {
    db = await createDatabase()
  })

  it("asks the agent with the Slack tools and caches its answer", async () => {
    const item = await insertPull(db)
    const runner = vi
      .fn<AgentRunner>()
      .mockResolvedValue({ searched: true, discussions: [thread, thread] })

    expect(await requestLookup(db, item, { runner })).toMatchObject({
      status: "pending",
    })
    await drainLookups()

    const [task, config] = runner.mock.calls[0]
    expect(task.prompt).toContain("api/pull/8")
    expect(task.prompt).toContain("select:mcp__claude_ai_Slack__")
    expect(config.kind).toBe("claude")
    expect(task.allowedTools).toContain(
      "mcp__claude_ai_Slack__slack_search_public_and_private"
    )

    const [lookup] = await db.select().from(slackLookups)
    expect(lookup).toMatchObject({ status: "done", error: null })
    // Duplicate threads are returned once.
    expect(lookup.discussions).toHaveLength(1)

    await requestLookup(db, item, { runner })
    expect(runner).toHaveBeenCalledTimes(1)
  })

  it("records agent failures and retries when forced", async () => {
    const item = await insertPull(db)
    const failing = vi
      .fn<AgentRunner>()
      .mockRejectedValue(new Error("Commande introuvable"))
    await requestLookup(db, item, { runner: failing })
    await drainLookups()
    expect((await db.select().from(slackLookups))[0]).toMatchObject({
      status: "error",
      error: "Commande introuvable",
    })

    const working = vi
      .fn<AgentRunner>()
      .mockResolvedValue({ searched: true, discussions: [] })
    await requestLookup(db, item, { runner: working, force: true })
    await drainLookups()
    const [lookup] = await db
      .select()
      .from(slackLookups)
      .where(eq(slackLookups.itemKey, item.key))
    expect(lookup).toMatchObject({ status: "done", discussions: [] })
  })

  it("fails when the agent could not reach Slack", async () => {
    const item = await insertPull(db)
    const runner = vi
      .fn<AgentRunner>()
      .mockResolvedValue({ searched: false, discussions: [] })
    await requestLookup(db, item, { runner })
    await drainLookups()
    expect((await db.select().from(slackLookups))[0]).toMatchObject({
      status: "error",
      error: expect.stringContaining("pas pu accéder à Slack"),
    })
  })

  it("rejects answers that do not follow the schema", async () => {
    const item = await insertPull(db)
    const runner = vi
      .fn<AgentRunner>()
      .mockResolvedValue({ discussions: [{ channel: "#x" }] })
    await requestLookup(db, item, { runner })
    await drainLookups()
    expect((await db.select().from(slackLookups))[0].status).toBe("error")
  })

  it("appends a reply sent from the app to its thread", async () => {
    const item = await insertPull(db)
    const runner = vi
      .fn<AgentRunner>()
      .mockResolvedValue({ searched: true, discussions: [thread] })
    await requestLookup(db, item, { runner })
    await drainLookups()

    await appendReply(
      db,
      item.key,
      thread.permalink,
      "on it",
      new Date("2026-10-12T10:00:00Z")
    )
    const [lookup] = await db.select().from(slackLookups)
    expect(lookup.discussions[0].messages.at(-1)).toEqual({
      author: "Toi",
      text: "on it",
      postedAt: "2026-10-12T10:00:00.000Z",
    })
  })

  it("tells the agent to skip excluded channels", async () => {
    const item = await insertPull(db)
    await updatePreferences(db, {
      slackExcludedChannels: ["#tech-team-general"],
    })
    const runner = vi
      .fn<AgentRunner>()
      .mockResolvedValue({ searched: true, discussions: [] })
    await requestLookup(db, item, { runner })
    await drainLookups()
    expect(runner.mock.calls[0][0].prompt).toContain(
      "Ignore these channels entirely: #tech-team-general."
    )
  })
})
