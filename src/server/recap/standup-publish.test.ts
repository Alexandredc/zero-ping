import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Database } from "@/server/db/client"
import { messagesFor } from "@/lib/i18n/messages"
import { publishStandup } from "./standup"
import type { StandupState } from "./standup"

const runAgent = vi.hoisted(() => vi.fn())

vi.mock("@/server/agents/runner", () => ({
  getAgentConfig: () => ({ kind: "claude" }),
  runAgent,
}))
vi.mock("@/server/preferences", () => ({
  getPreferences: () => Promise.resolve({}),
}))
vi.mock("@/server/i18n", () => ({
  getMessages: () => Promise.resolve({ t: messagesFor("fr"), language: "fr" }),
}))
vi.mock("@/server/inbox/attention", () => ({ recordAttention: vi.fn() }))

const PERMALINK = "https://acme.slack.com/archives/C1/p1791445131867549"

/** The settings table, as `readStandup` and `writeStandup` use it. */
function fakeDb(state: Partial<StandupState>) {
  let value: Partial<StandupState> = state
  const db = {
    select: () => ({
      from: () => ({ where: () => Promise.resolve([{ value }]) }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: ({ set }: { set: { value: StandupState } }) => {
          value = set.value
          return Promise.resolve()
        },
      }),
    }),
  }
  return { db: db as unknown as Database, current: () => value }
}

/** A standup ready to post: its thread is today's reminder. */
const ready = (): Partial<StandupState> => ({
  status: "done",
  message: "**Point équipe**",
  slackMessage: "<@U1> : livré",
  channelId: "C1",
  threadTs: `${Math.floor(Date.now() / 1000)}.000100`,
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => runAgent.mockReset())

describe("publishStandup", () => {
  it("joins the publish in progress instead of posting twice", async () => {
    const answer = deferred<unknown>()
    runAgent.mockReturnValue(answer.promise)
    const { db, current } = fakeDb(ready())

    const first = publishStandup(db, "team")
    const second = publishStandup(db, "team")
    expect(second).toBe(first)

    answer.resolve({ sent: true, permalink: PERMALINK })
    const [a, b] = await Promise.all([first, second])
    expect(runAgent).toHaveBeenCalledOnce()
    expect(a.postedLink).toBe(PERMALINK)
    expect(b).toBe(a)
    expect(current().postedLink).toBe(PERMALINK)
  })

  it("lets the user try again once a publish failed", async () => {
    runAgent.mockResolvedValueOnce({ sent: false, permalink: "" })
    const { db, current } = fakeDb(ready())

    await expect(publishStandup(db, "me")).rejects.toThrow(
      messagesFor("fr").server.errors.slackNotConfirmed
    )
    expect(current().postedAt ?? null).toBeNull()

    runAgent.mockResolvedValueOnce({ sent: true, permalink: PERMALINK })
    await expect(publishStandup(db, "me")).resolves.toMatchObject({
      postedLink: PERMALINK,
    })
    expect(runAgent).toHaveBeenCalledTimes(2)
  })

  it("keeps the team and personal standups apart", async () => {
    runAgent.mockResolvedValue({ sent: true, permalink: PERMALINK })
    const team = publishStandup(fakeDb(ready()).db, "team")
    const me = publishStandup(fakeDb(ready()).db, "me")
    expect(me).not.toBe(team)
    await Promise.all([team, me])
    expect(runAgent).toHaveBeenCalledTimes(2)
  })
})
