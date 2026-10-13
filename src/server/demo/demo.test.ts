import { eq } from "drizzle-orm"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { createDatabase } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import { items, settings } from "@/server/db/schema"
import { getOctokit, getViewer } from "@/server/github/client"
import { runAgent } from "@/server/agents/runner"
import { getDecisionModel } from "@/server/ai/models"
import { buildDashboard } from "@/server/dashboard/dashboard"
import { buildRecap } from "@/server/recap/recap"
import { DEMO_OFFLINE, DEMO_VIEWER, isDemo } from "./mode"
import { DEMO_MARKER, assertDemoDatabase, scoredItems, seedDemo } from "./seed"
import { demoActions, keywordSearch } from "./actions"
import { demoItems, demoPulls } from "./fixtures"

const NOW = new Date("2026-10-13T08:30:00Z")

describe("isDemo", () => {
  it("is on only for DEMO=1", () => {
    expect(isDemo({ DEMO: "1" })).toBe(true)
    expect(isDemo({ DEMO: "true" })).toBe(false)
    expect(isDemo({})).toBe(false)
  })
})

describe("demo guards", () => {
  beforeEach(() => vi.stubEnv("DEMO", "1"))
  afterEach(() => vi.unstubAllEnvs())

  it("never reaches GitHub, an agent or Jev", async () => {
    await expect(getOctokit()).rejects.toThrow(DEMO_OFFLINE)
    await expect(getViewer()).resolves.toEqual(DEMO_VIEWER)
    await expect(
      runAgent(
        { prompt: "hi", schema: {} },
        { kind: "claude", command: "claude", model: undefined }
      )
    ).rejects.toThrow(DEMO_OFFLINE)
    vi.stubEnv("TYPESAFE_AI_API_KEY", "key")
    expect(getDecisionModel()).toBeNull()
  })
})

describe("demo fixtures", () => {
  it("only use fictional people and repositories", () => {
    const text = JSON.stringify([
      demoItems(NOW),
      demoPulls(NOW).map((p) => ({ ...p, c: p.conversation?.() })),
    ])
    const logins = new Set(demoItems(NOW).map((item) => item.author))
    expect([...logins].sort()).toEqual([
      "alex-martin",
      "github-actions[bot]",
      "jane-doe",
      "nina-rossi",
      "priya-shah",
      "renovate[bot]",
      "sam-lee",
      "tom-becker",
    ])
    for (const match of text.matchAll(/github\.com\/([\w-]+)\//g))
      expect(match[1]).toBe("acme")
  })

  it("scores items like the live sync", () => {
    const scored = scoredItems(NOW)
    const urgent = scored.find((item) => item.key === "acme/web#238")!
    expect(urgent.priority).toBeGreaterThan(
      scored.find((item) => item.key === "acme/api#405")!.priority!
    )
    expect(urgent.priorityReasons!.length).toBeGreaterThan(0)
  })
})

describe("keywordSearch", () => {
  it("keeps the candidates naming a word of the query", () => {
    const candidates = [
      {
        key: "a",
        title: "Rate limiting",
        author: "alex",
        labels: [],
        facts: [],
      },
      {
        key: "b",
        title: "Dark mode",
        author: "nina",
        labels: ["ui"],
        facts: [],
      },
    ]
    expect(keywordSearch({ query: "le rate limiting", candidates })).toEqual([
      { key: "a", reason: "Contient « rate », « limiting »." },
    ])
    expect(keywordSearch({ query: "ui", candidates })).toEqual([])
  })
})

describe("demo database", () => {
  let db: Database
  const globalForDb = globalThis as unknown as {
    __githubInboxDb?: Promise<Database>
  }

  beforeAll(async () => {
    db = await createDatabase()
    globalForDb.__githubInboxDb = Promise.resolve(db)
    await seedDemo(db, NOW)
  }, 30_000)
  afterAll(async () => {
    globalForDb.__githubInboxDb = undefined
    await db.$client.close()
  })

  it("fills every folder, the recap and the dashboard", async () => {
    const recap = await buildRecap(db, NOW)
    expect(recap.counts).toMatchObject({
      review: 5,
      awaiting: 2,
      ciFailing: 1,
      readyToMerge: 1,
      team: 5,
    })
    const dashboard = await buildDashboard(
      db,
      DEMO_VIEWER,
      { reviewSlaHours: 24 },
      NOW
    )
    expect(dashboard.trends.enteredTotal).toBeGreaterThan(0)
    expect(dashboard.team.open).toBeGreaterThan(dashboard.team.stuck)
  })

  it("seeds again over its own data", async () => {
    await seedDemo(db, NOW)
    expect(await db.select().from(items)).toHaveLength(demoItems(NOW).length)
  })

  it("refuses to wipe a database with real data", async () => {
    const real = await createDatabase()
    try {
      await real.insert(items).values({ ...scoredItems(NOW)[0] })
      await expect(assertDemoDatabase(real)).rejects.toThrow("vraies données")
      await expect(seedDemo(real, NOW)).rejects.toThrow("vraies données")
      await real.insert(settings).values({ key: DEMO_MARKER, value: {} })
      await expect(assertDemoDatabase(real)).resolves.toBeUndefined()
    } finally {
      await real.$client.close()
    }
  }, 30_000)

  it("answers the GitHub reads from the fixtures", async () => {
    const { conversation } = await demoActions.getConversation("acme/api#412")
    expect(conversation?.branches).toEqual({
      head: "feat/rate-limiting",
      base: "main",
    })
    const files = await demoActions.getPullFiles("acme/api#412")
    expect(files.files.length).toBeGreaterThan(0)
    expect(files.totalAdditions).toBe(
      files.files.reduce((sum, f) => sum + f.additions, 0)
    )
    const issues = await demoActions.listIssues()
    expect(issues.sprint.items.length).toBeGreaterThan(issues.assigned.length)
    expect((await demoActions.getPullInsights("acme/api#412")).available).toBe(
      true
    )
    const notice = await demoActions.getReviewNotice("acme/api#412", "APPROVE")
    expect(notice).toMatchObject({ enabled: true, channel: "pull-requests" })
  })

  it("gives a sprint ticket an empty Slack result without searching", async () => {
    const slack = await demoActions.getSlackDiscussions("acme/web#245", false, {
      kind: "Issue",
      title: "Empty state for the search page",
      url: "https://github.com/acme/web/issues/245",
    })
    expect(slack.lookup).toMatchObject({ status: "done", discussions: [] })
  })

  it("refuses every write that would leave the machine", () => {
    expect(() => demoActions.reply()).toThrow(DEMO_OFFLINE)
    expect(() => demoActions.submitReview()).toThrow(DEMO_OFFLINE)
    expect(() => demoActions.sendReviewNotice()).toThrow(DEMO_OFFLINE)
    expect(() => demoActions.merge()).toThrow(DEMO_OFFLINE)
    expect(() => demoActions.postStandup()).toThrow(DEMO_OFFLINE)
  })

  it("marks items done locally", async () => {
    await demoActions.markDone(["acme/web#238"], true)
    const [row] = await db
      .select()
      .from(items)
      .where(eq(items.key, "acme/web#238"))
    expect(row.doneAt).not.toBeNull()
  })
})
