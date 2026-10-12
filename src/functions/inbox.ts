import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  countFolders,
  countPings,
  countTeamProblems,
  getChecks,
  getMergeInfo,
  getRecap,
  listTeam,
  merge,
  rerunChecks,
  runStandup,
  takeReview,
  getConversation,
  getPullFiles,
  generateSummary,
  getAttention,
  getSettings,
  getSummary,
  getSlackDiscussions,
  replyInSlack,
  savePreferences,
  listAccessibleRepos,
  listInbox,
  listRepos,
  markDone,
  markFileViewed,
  reply,
  setRepoTracked,
  snooze,
  submitReview,
} from "@/server/inbox/actions"
import { ensureSyncLoop, getSyncStatus, syncNow } from "@/server/inbox/loop"
import { preferencesPatchSchema } from "@/server/preferences"

const folderSchema = z.enum([
  "review",
  "awaiting",
  "mine",
  "other",
  "snoozed",
  "done",
])

export const getInbox = createServerFn({ method: "GET" })
  .validator(
    z.object({
      folder: folderSchema,
      repo: z.string().optional(),
      sort: z.enum(["priority", "size"]).optional(),
    })
  )
  .handler(async ({ data }) => {
    ensureSyncLoop()
    const [items, counts, team] = await Promise.all([
      listInbox(data.folder, data.repo, data.sort),
      countFolders(),
      countTeamProblems(),
    ])
    return { items, counts, team, sync: getSyncStatus() }
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

const keysSchema = z.array(z.string()).min(1).max(500)

export const setDone = createServerFn({ method: "POST" })
  .validator(z.object({ keys: keysSchema, done: z.boolean() }))
  .handler(({ data }) => markDone(data.keys, data.done))

export const setSnooze = createServerFn({ method: "POST" })
  .validator(z.object({ keys: keysSchema, until: z.iso.datetime().nullable() }))
  .handler(({ data }) =>
    snooze(data.keys, data.until ? new Date(data.until) : null)
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

export const getSlack = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getSlackDiscussions(data.key))

export const refreshSlack = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getSlackDiscussions(data.key, true))

export const postSlackReply = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string(),
      permalink: z.url(),
      message: z.string().trim().min(1).max(4000),
    })
  )
  .handler(({ data }) => replyInSlack(data.key, data.permalink, data.message))

export const getAppSettings = createServerFn({ method: "GET" }).handler(() =>
  getSettings()
)

export const setPreferences = createServerFn({ method: "POST" })
  .validator(preferencesPatchSchema)
  .handler(({ data }) => savePreferences(data))

export const getItemSummary = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getSummary(data.key))

export const summarizeItem = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string(),
      length: z.enum(["short", "standard", "detailed"]),
    })
  )
  .handler(({ data }) => generateSummary(data.key, data.length))

export const getAttentionEvents = createServerFn({ method: "GET" })
  .validator(z.object({ afterId: z.number().int().nullable() }))
  .handler(({ data }) => getAttention(data.afterId))

export const getPingCount = createServerFn({ method: "GET" }).handler(() =>
  countPings()
)

export const getItemFiles = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string(), sinceReview: z.boolean().optional() }))
  .handler(({ data }) => getPullFiles(data.key, data.sinceReview))

export const setFileViewedState = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pullRequestId: z.string(),
      path: z.string(),
      viewed: z.boolean(),
    })
  )
  .handler(({ data }) =>
    markFileViewed(data.pullRequestId, data.path, data.viewed)
  )

export const getItemMergeInfo = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getMergeInfo(data.key))

export const postMerge = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string(),
      method: z.enum(["SQUASH", "MERGE", "REBASE"]),
      deleteBranch: z.boolean(),
    })
  )
  .handler(({ data }) => merge(data.key, data.method, data.deleteBranch))

export const getItemChecks = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getChecks(data.key))

export const postRerunChecks = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => rerunChecks(data.key))

export const getTeam = createServerFn({ method: "GET" }).handler(() => {
  ensureSyncLoop()
  return listTeam()
})

export const postTakeReview = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => takeReview(data.key))

export const getDailyRecap = createServerFn({ method: "GET" }).handler(() => {
  ensureSyncLoop()
  return getRecap()
})

export const postRunStandup = createServerFn({ method: "POST" }).handler(() =>
  runStandup()
)
