import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  countFolders,
  getConversation,
  listAccessibleRepos,
  listInbox,
  listRepos,
  markDone,
  reply,
  setRepoTracked,
  snooze,
  submitReview,
} from "@/server/inbox/actions"
import { ensureSyncLoop, getSyncStatus, syncNow } from "@/server/inbox/loop"

const folderSchema = z.enum([
  "review",
  "awaiting",
  "mine",
  "other",
  "snoozed",
  "done",
])

export const getInbox = createServerFn({ method: "GET" })
  .validator(z.object({ folder: folderSchema, repo: z.string().optional() }))
  .handler(async ({ data }) => {
    ensureSyncLoop()
    const [items, counts] = await Promise.all([
      listInbox(data.folder, data.repo),
      countFolders(),
    ])
    return { items, counts, sync: getSyncStatus() }
  })

export const getItemConversation = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getConversation(data.key))

export const triggerSync = createServerFn({ method: "POST" }).handler(
  async () => {
    await syncNow({ forceSearch: true })
    return getSyncStatus()
  }
)

export const setDone = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string(), done: z.boolean() }))
  .handler(({ data }) => markDone(data.key, data.done))

export const setSnooze = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string(), until: z.iso.datetime().nullable() }))
  .handler(({ data }) =>
    snooze(data.key, data.until ? new Date(data.until) : null)
  )

export const postReply = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string(),
      body: z.string().trim().min(1),
      target: z.discriminatedUnion("type", [
        z.object({ type: z.literal("conversation") }),
        z.object({
          type: z.literal("thread"),
          commentDatabaseId: z.number().int(),
        }),
      ]),
    })
  )
  .handler(({ data }) => reply(data.key, data.body, data.target))

export const postReview = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string(),
      event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
      body: z.string(),
    })
  )
  .handler(({ data }) => submitReview(data.key, data.event, data.body))

export const getRepos = createServerFn({ method: "GET" }).handler(() =>
  listRepos()
)

export const getAccessibleRepos = createServerFn({ method: "GET" }).handler(
  () => listAccessibleRepos()
)

export const setRepo = createServerFn({ method: "POST" })
  .validator(z.object({ fullName: z.string(), tracked: z.boolean() }))
  .handler(async ({ data }) => {
    await setRepoTracked(data.fullName, data.tracked)
    if (data.tracked) void syncNow()
  })
