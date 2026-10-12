import { eq } from "drizzle-orm"
import type { Octokit } from "octokit"
import { beforeEach, describe, expect, it } from "vitest"
import { pollNotifications } from "./sync"
import type { RawNotification } from "./notifications"
import { createDatabase } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import { items, repos } from "@/server/db/schema"

function notification(
  id: string,
  updatedAt: string,
  number = 12
): RawNotification {
  return {
    id,
    unread: true,
    reason: "review_requested",
    updated_at: updatedAt,
    subject: {
      title: "Add retries",
      url: `https://api.github.com/repos/acme/api/pulls/${number}`,
      type: "PullRequest",
    },
    repository: {
      full_name: "acme/api",
      html_url: "https://github.com/acme/api",
    },
  }
}

/** Minimal Octokit stand-in: serves queued responses and records request headers. */
function fakeOctokit(responses: (RawNotification[] | 304)[]) {
  const headers: Record<string, string>[] = []
  const octokit = {
    request: async (
      _route: string,
      params: { headers: Record<string, string> }
    ) => {
      headers.push(params.headers)
      const next = responses.shift()
      if (next === 304 || next === undefined) {
        throw Object.assign(new Error("Not modified"), { status: 304 })
      }
      return {
        data: next,
        headers: {
          "x-poll-interval": "60",
          "last-modified": "Mon, 12 Oct 2026 12:00:00 GMT",
        },
      }
    },
  } as unknown as Octokit
  return { octokit, headers }
}

describe("pollNotifications", () => {
  let db: Database

  beforeEach(async () => {
    db = await createDatabase()
  })

  it("stores subjects, registers their repo and reuses Last-Modified", async () => {
    const { octokit, headers } = fakeOctokit([
      [notification("1", "2026-10-12T10:00:00Z")],
      304,
    ])

    expect(await pollNotifications(db, octokit)).toEqual({
      changed: 1,
      pollInterval: 60,
    })
    const [item] = await db.select().from(items)
    expect(item).toMatchObject({
      key: "acme/api#12",
      kind: "PullRequest",
      htmlUrl: "https://github.com/acme/api/pull/12",
      threadId: "1",
    })
    expect(await db.select().from(repos)).toMatchObject([
      { fullName: "acme/api", tracked: true },
    ])

    expect(await pollNotifications(db, octokit)).toEqual({
      changed: 0,
      pollInterval: 60,
    })
    expect(headers[1]).toEqual({
      "if-modified-since": "Mon, 12 Oct 2026 12:00:00 GMT",
    })
  })

  it("brings a done subject back only when there is newer activity", async () => {
    const { octokit } = fakeOctokit([
      [notification("1", "2026-10-12T10:00:00Z")],
      [notification("1", "2026-10-12T10:00:00Z")],
      [notification("1", "2026-10-12T15:00:00Z")],
    ])
    await pollNotifications(db, octokit)
    await db
      .update(items)
      .set({ doneAt: new Date("2026-10-12T11:00:00Z") })
      .where(eq(items.key, "acme/api#12"))

    await pollNotifications(db, octokit)
    expect((await db.select().from(items))[0].doneAt).not.toBeNull()

    await pollNotifications(db, octokit)
    expect((await db.select().from(items))[0].doneAt).toBeNull()
  })
})
