import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import {
  countFolders,
  countPings,
  countTeamProblems,
  getDashboard,
  getChecks,
  getMergeInfo,
  getRecap,
  listTeam,
  merge,
  rerunChecks,
  runStandup,
  postStandup,
  takeReview,
  getReviewerOptions,
  listIssues,
  getWeekSummary,
  moveWorkItem,
  getProjectFields,
  getUatStatus,
  searchItems,
  getWorkConversation,
  setReviewers,
  getConversation,
  getPullFiles,
  generateSummary,
  getAttention,
  getSettings,
  getSummary,
  getSlackDiscussions,
  replyInSlack,
  setSlackRead,
  getMentionCandidates,
  askAboutItem,
  getReviewNotice,
  sendReviewNotice,
  getPullInsights,
  getSummaryRead,
  setSummaryRead,
  clearChat,
  getChat,
  savePreferences,
  listAccessibleRepos,
  listInbox,
  listAllPulls,
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
      /** In « Mes PR », every open PR of the tracked repos instead of the viewer's. */
      scope: z.enum(["mine", "all"]).optional(),
    })
  )
  .handler(async ({ data }) => {
    ensureSyncLoop()
    const [items, counts, team] = await Promise.all([
      data.folder === "mine" && data.scope === "all"
        ? listAllPulls(data.repo, data.sort)
        : listInbox(data.folder, data.repo, data.sort),
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

const slackSubject = z.object({
  key: z.string(),
  /** For an issue of « Mes issues », which the server may not know. */
  subject: z
    .object({
      kind: z.enum(["PullRequest", "Issue"]),
      title: z.string(),
      url: z.string(),
    })
    .optional(),
})

export const getSlack = createServerFn({ method: "GET" })
  .validator(slackSubject)
  .handler(({ data }) => getSlackDiscussions(data.key, false, data.subject))

export const refreshSlack = createServerFn({ method: "POST" })
  .validator(slackSubject)
  .handler(({ data }) => getSlackDiscussions(data.key, true, data.subject))

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

export const getFolderCounts = createServerFn({ method: "GET" }).handler(() =>
  countFolders()
)

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

export const getItemReviewerOptions = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getReviewerOptions(data.key))

export const postReviewers = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string(), reviewers: z.array(z.string()) }))
  .handler(({ data }) => setReviewers(data.key, data.reviewers))

export const getWorkItemConversation = createServerFn({ method: "GET" })
  .validator(
    z.object({ key: z.string(), kind: z.enum(["Issue", "PullRequest"]) })
  )
  .handler(({ data }) => getWorkConversation(data.key, data.kind))

export const getItemProjectFields = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getProjectFields(data.key))

export const getItemUatStatus = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getUatStatus(data.key))

export const postSearch = createServerFn({ method: "POST" })
  .validator(
    z.object({
      kind: z.enum(["PR", "issue"]),
      query: z.string().trim().min(1).max(500),
      candidates: z.array(
        z.object({
          key: z.string(),
          title: z.string(),
          author: z.string().nullable(),
          labels: z.array(z.string()),
          facts: z.array(z.string()),
        })
      ),
    })
  )
  .handler(({ data }) => searchItems(data))

export const postWorkItemStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      projectId: z.string(),
      itemId: z.string(),
      fieldId: z.string(),
      optionId: z.string(),
    })
  )
  .handler(({ data }) => moveWorkItem(data))

export const postSlackRead = createServerFn({ method: "POST" })
  .validator(
    z.object({ permalink: z.string(), readThrough: z.string().nullable() })
  )
  .handler(({ data }) => setSlackRead(data.permalink, data.readThrough))

export const getMentions = createServerFn({ method: "GET" })
  .validator(z.object({ repo: z.string() }))
  .handler(({ data }) => getMentionCandidates(data.repo))

export const getItemReviewNotice = createServerFn({ method: "GET" })
  .validator(
    z.object({
      key: z.string(),
      event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
    })
  )
  .handler(({ data }) => getReviewNotice(data.key, data.event))

export const postReviewNotice = createServerFn({ method: "POST" })
  .validator(
    z.object({
      message: z.string().trim().min(1).max(4000),
      threadPermalink: z.string().nullable(),
      mentions: z.array(
        z.object({ login: z.string(), name: z.string().nullable() })
      ),
    })
  )
  .handler(({ data }) => sendReviewNotice(data))

export const getInsights = createServerFn({ method: "GET" })
  .validator(slackSubject)
  .handler(({ data }) => getPullInsights(data.key, false, data.subject))

export const refreshInsights = createServerFn({ method: "POST" })
  .validator(slackSubject)
  .handler(({ data }) => getPullInsights(data.key, true, data.subject))

export const getSummaryReadState = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getSummaryRead(data.key))

export const postSummaryRead = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string(), read: z.boolean() }))
  .handler(({ data }) => setSummaryRead(data.key, data.read))

export const getItemChat = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => getChat(data.key))

export const postQuestion = createServerFn({ method: "POST" })
  .validator(
    z.object({ key: z.string(), question: z.string().trim().min(1).max(4000) })
  )
  .handler(({ data }) => askAboutItem(data.key, data.question))

export const deleteChat = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string() }))
  .handler(({ data }) => clearChat(data.key))

export const getWeek = createServerFn({ method: "GET" }).handler(() =>
  getWeekSummary()
)

export const getIssues = createServerFn({ method: "GET" }).handler(() =>
  listIssues()
)

export const getDailyRecap = createServerFn({ method: "GET" }).handler(() => {
  ensureSyncLoop()
  return getRecap()
})

const standupKind = z.object({ kind: z.enum(["team", "me"]) })

export const postRunStandup = createServerFn({ method: "POST" })
  .validator(standupKind)
  .handler(({ data }) => runStandup(data.kind))

export const getDashboardData = createServerFn({ method: "GET" }).handler(
  () => {
    ensureSyncLoop()
    return getDashboard()
  }
)

export const postStandupToSlack = createServerFn({ method: "POST" })
  .validator(standupKind)
  .handler(({ data }) => postStandup(data.kind))
