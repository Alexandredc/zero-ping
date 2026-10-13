import { messagesFor } from "@/lib/i18n/messages"
import { beforeEach, describe, expect, it } from "vitest"
import { detectAttention, readAttention, recordAttention } from "./attention"
import { createDatabase } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import type { Item } from "@/server/db/schema"

const fr = messagesFor("fr")
const en = messagesFor("en")
const NOW = new Date("2026-10-12T12:00:00Z")

const before = {
  key: "acme/api#8",
  repoFullName: "acme/api",
  number: 8,
  title: "Add retries",
  view: "other",
  awaitingUrl: null,
  awaitingFrom: null,
  awaitingExcerpt: null,
  reviewRequest: null,
  reviewDecision: null,
  ciState: "SUCCESS",
  state: "OPEN",
  doneAt: null,
  snoozedUntil: null,
} as unknown as Item

describe("detectAttention", () => {
  it("announces a new review request once", () => {
    const after = {
      ...before,
      view: "review" as const,
      reviewRequest: "direct" as const,
    }
    expect(detectAttention(before, after, fr, NOW)).toEqual({
      itemKey: "acme/api#8",
      kind: "review",
      title: "Review demandée",
      body: "api#8 · Add retries",
    })
    expect(detectAttention({ ...before, ...after }, after, fr, NOW)).toBeNull()
  })

  it("announces fixes pushed after the viewer's requested changes", () => {
    const after = { ...before, view: "review" as const }
    expect(detectAttention(before, after, fr, NOW)?.title).toBe(
      "Corrections poussées après ta review"
    )
  })

  it("announces each new message waiting for the viewer", () => {
    const after = {
      ...before,
      view: "awaiting" as const,
      awaitingUrl: "https://github.com/acme/api/pull/8#issuecomment-1",
      awaitingFrom: "dev",
      awaitingExcerpt: "@lead ok to merge?",
    }
    expect(detectAttention(before, after, fr, NOW)).toMatchObject({
      kind: "awaiting",
      title: "@dev attend ta réponse",
      body: "api#8 · Add retries\n@lead ok to merge?",
    })
    expect(detectAttention({ ...before, ...after }, after, fr, NOW)).toBeNull()
  })

  it("watches the viewer's own PR for requested changes and failing CI", () => {
    const mine = { ...before, view: "mine" as const }
    expect(
      detectAttention(
        mine,
        { ...mine, reviewDecision: "CHANGES_REQUESTED" },
        fr,
        NOW
      )?.kind
    ).toBe("changes")
    expect(
      detectAttention(mine, { ...mine, ciState: "FAILURE" }, fr, NOW)?.kind
    ).toBe("ci")
  })

  it("stays quiet for closed, done or snoozed items", () => {
    const after = { ...before, view: "review" as const }
    expect(
      detectAttention(before, { ...after, state: "MERGED" }, fr, NOW)
    ).toBeNull()
    expect(
      detectAttention({ ...before, doneAt: NOW }, after, fr, NOW)
    ).toBeNull()
    expect(
      detectAttention(
        { ...before, snoozedUntil: new Date("2026-10-13T00:00:00Z") },
        after,
        fr,
        NOW
      )
    ).toBeNull()
  })
})

describe("detectAttention in English", () => {
  it("writes the notification in the chosen language", () => {
    const after = {
      ...before,
      view: "awaiting" as const,
      awaitingUrl: "https://github.com/acme/api/pull/8#issuecomment-1",
      awaitingFrom: null,
      awaitingExcerpt: null,
    }
    expect(detectAttention(before, after, en, NOW)?.title).toBe(
      "@someone is waiting for your reply"
    )
    const team = {
      ...before,
      view: "review" as const,
      reviewRequest: "team" as const,
    }
    expect(detectAttention(before, team, en, NOW)?.title).toBe(
      "Review requested from your team"
    )
  })
})

describe("attention events", () => {
  let db: Database

  beforeEach(async () => {
    db = await createDatabase()
  })

  it("starts from a baseline and returns only newer events of the wanted kinds", async () => {
    expect(await readAttention(db, null, ["review"])).toEqual({
      latestId: 0,
      events: [],
    })
    await recordAttention(db, [
      { itemKey: "a#1", kind: "review", title: "Review demandée", body: "a#1" },
      {
        itemKey: "a#2",
        kind: "ci",
        title: "La CI de ta PR échoue",
        body: "a#2",
      },
    ])
    const { latestId, events } = await readAttention(db, 0, ["review"])
    expect(latestId).toBe(2)
    expect(events.map((event) => event.itemKey)).toEqual(["a#1"])
    expect((await readAttention(db, 2, ["review", "ci"])).events).toEqual([])
    expect((await readAttention(db, 0, [])).events).toEqual([])
  })
})
