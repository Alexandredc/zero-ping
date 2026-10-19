import type { z } from "zod"
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm"
import { getDb } from "@/server/db/client"
import { getLanguage, getMessages } from "@/server/i18n"
import { messagesFor } from "@/lib/i18n/messages"
import type { Messages } from "@/lib/i18n/messages"
import {
  SUMMARY_LENGTHS,
  items,
  repos,
  slackLookups,
  slackReads,
  summaries,
  itemChats,
  pullInsights,
  summaryReads,
  teamPulls,
} from "@/server/db/schema"
import type {
  ChatMessage,
  Item,
  Summary,
  SummaryLength,
  View,
} from "@/server/db/schema"
import type { Database } from "@/server/db/client"
import { getOctokit, getViewer } from "@/server/github/client"
import { fetchConversation } from "@/server/github/conversation"
import type { Conversation } from "@/server/github/conversation"
import { createSwrCache } from "@/server/cache/swr"
import { fetchPullFiles, setFileViewed } from "@/server/github/pull-files"
import { fetchMergeInfo, mergePull } from "@/server/github/merge"
import type { MergeMethod } from "@/server/github/merge"
import { fetchChecks, rerunFailedJobs } from "@/server/github/checks"
import type { PullChecks } from "@/server/github/checks"
import {
  fetchReviewerOptions,
  reviewerChanges,
  updateReviewers,
} from "@/server/github/reviewers"
import {
  fetchAssignedIssues,
  fetchSprint,
  setItemStatus,
} from "@/server/issues/sprint"
import type { Sprint, WorkItem } from "@/server/issues/sprint"
import { fetchProjectFields } from "@/server/issues/project-fields"
import {
  pickSprintProject,
  sprintBoard,
  sprintProjects,
} from "@/server/issues/project"
import {
  fetchPullForUat,
  fetchUatCommits,
  isOnUat,
  uatLedger,
  uatStatus,
} from "@/server/github/uat"
import type { UatEntry, UatStatus } from "@/server/github/uat"
import {
  MAX_CANDIDATES,
  buildSearchInput,
  buildSearchPrompt,
  fetchBodies,
  parseSearchAnswer,
  searchJsonSchema,
} from "@/server/search/smart-search"
import type { SearchCandidate, SearchMatch } from "@/server/search/smart-search"
import type { Octokit } from "octokit"
import { buildRecap } from "@/server/recap/recap"
import { fetchWeekSummary } from "@/server/recap/week"
import {
  publishBlocker,
  publishStandup,
  readStandup,
  startStandup,
} from "@/server/recap/standup"
import type { StandupKind } from "@/server/recap/standup"
import { localDate } from "@/server/recap/schedule"
import { getSyncStatus, rescheduleSync, syncNow } from "@/server/inbox/loop"
import { recordActivity, viewTransitions } from "@/server/dashboard/activity"
import { buildDashboard } from "@/server/dashboard/dashboard"
import { parseSubjectKey } from "@/server/inbox/notifications"
import { enrichItems } from "@/server/inbox/sync"
import { readAttention } from "@/server/inbox/attention"
import {
  SUMMARY_JSON_SCHEMA,
  buildSummaryInput,
  buildSummaryPrompt,
  parseSummary,
} from "@/server/summary/summarize"
import {
  getPreferences,
  doNotDisturb,
  channelIdOf,
  normalizeChannel,
  updatePreferences,
  withoutExcludedChannels,
} from "@/server/preferences"
import type { preferencesPatchSchema } from "@/server/preferences"
import { AGENT_LABEL, getAgentConfig, runAgent } from "@/server/agents/runner"
import {
  buildInsightState,
  buildIssueInsightState,
  computeInsights,
  insightHash,
} from "@/server/ai/insights"
import { issueInsightSpecs, pullInsightSpecs } from "@/lib/insights"
import { getDecisionModel } from "@/server/ai/models"
import {
  buildChatInput,
  formatItemFacts,
  buildChatPrompt,
  formatDiff,
  chatJsonSchema,
  parseChatAnswer,
} from "@/server/summary/chat"
import { subjectToItem, teamPullToItem } from "@/server/team/as-item"
import {
  ISSUES_PAGE,
  ISSUES_PER_PAGE,
  fetchRepoIssues,
  mergeIssues,
  pageOf,
  teamIssueToItem,
} from "@/server/team/issues"
import type { IssuePage } from "@/server/team/issues"
import {
  readScores,
  scoreInBackground,
  trustedUrgency,
} from "@/server/ai/scores"
import type { Score, ScoreSubject } from "@/server/ai/scores"
import {
  appendReply,
  requestLookup,
  resolveAgentConfig,
  slackEnabled,
  slackExclusions,
} from "@/server/slack/lookups"
import {
  buildNoticePrompt,
  draftReviewNotice,
} from "@/server/slack/review-notice"
import type { NoticeMention } from "@/server/slack/review-notice"
import {
  REPLY_JSON_SCHEMA,
  buildReplyPrompt,
  parsePermalink,
  parseReply,
  slackSendTools,
} from "@/server/slack/reply"

export type Folder = View | "snoozed" | "done"

export const FOLDERS: Folder[] = [
  "review",
  "awaiting",
  "mine",
  "other",
  "snoozed",
  "done",
]

function folderCondition(folder: Folder, now: Date) {
  const notSnoozed = or(
    isNull(items.snoozedUntil),
    lte(items.snoozedUntil, now)
  )
  switch (folder) {
    case "snoozed":
      return and(isNull(items.doneAt), gt(items.snoozedUntil, now))
    case "done":
      return isNotNull(items.doneAt)
    default:
      return and(isNull(items.doneAt), notSnoozed, eq(items.view, folder))
  }
}

export type InboxItem = Item & {
  /** Slack threads found for the PR, or null when no search has finished. */
  slackDiscussions: number | null
  /** False for a teammate's PR shown in « Toutes les PR » without a notification. */
  inInbox: boolean
  /** Jev's urgency to rank by, null when unscored or too unsure. */
  jevUrgency: number | null
}

const jevUrgencyOf = (item: Item) =>
  item.aiUrgency === null
    ? null
    : trustedUrgency({ urgency: item.aiUrgency, confidence: item.aiConfidence })

export type SortOrder = "priority" | "size"

export async function listInbox(
  folder: Folder,
  repo?: string,
  sort: SortOrder = "priority"
): Promise<InboxItem[]> {
  const db = await getDb()
  const now = new Date()
  const rows = await db
    .select({ item: items, slack: slackLookups.discussions })
    .from(items)
    .innerJoin(repos, eq(repos.fullName, items.repoFullName))
    .leftJoin(
      slackLookups,
      and(eq(slackLookups.itemKey, items.key), eq(slackLookups.status, "done"))
    )
    .where(
      and(
        eq(repos.tracked, true),
        folderCondition(folder, now),
        repo ? eq(items.repoFullName, repo) : undefined
      )
    )
    .orderBy(
      ...(folder === "done"
        ? [desc(items.doneAt)]
        : sort === "size"
          ? [
              // Smallest first, so quick reviews unblock people fast; unknown sizes last.
              sql`${items.additions} + coalesce(${items.deletions}, 0) asc nulls last`,
              desc(items.priority),
            ]
          : [desc(items.priority), desc(items.updatedAt)])
    )
    .limit(200)
  const hiddenChannels = await slackExclusions(
    db,
    (await getPreferences(db)).slackExcludedChannels
  )
  return rows.map((row) => ({
    ...row.item,
    slackDiscussions: row.slack
      ? withoutExcludedChannels(row.slack, hiddenChannels).length
      : null,
    inInbox: true,
    jevUrgency: jevUrgencyOf(row.item),
  }))
}

/** The open items of the tracked repos already in the inbox, by key, as the inbox lists them. */
async function knownOpenItems(
  db: Database,
  kind: "PullRequest" | "Issue",
  repo?: string
): Promise<Map<string, InboxItem>> {
  const rows = await db
    .select({ item: items, slack: slackLookups.discussions })
    .from(items)
    .innerJoin(repos, eq(repos.fullName, items.repoFullName))
    .leftJoin(
      slackLookups,
      and(eq(slackLookups.itemKey, items.key), eq(slackLookups.status, "done"))
    )
    .where(
      and(
        eq(repos.tracked, true),
        eq(items.kind, kind),
        eq(items.state, "OPEN"),
        repo ? eq(items.repoFullName, repo) : undefined
      )
    )
  const hiddenChannels = await slackExclusions(
    db,
    (await getPreferences(db)).slackExcludedChannels
  )
  return new Map(
    rows.map((row) => [
      row.item.key,
      {
        ...row.item,
        slackDiscussions: row.slack
          ? withoutExcludedChannels(row.slack, hiddenChannels).length
          : null,
        inInbox: true,
        jevUrgency: jevUrgencyOf(row.item),
      },
    ])
  )
}

/**
 * Every open issue of the tracked repos, read from GitHub every few minutes:
 * there are too many for a snapshot, and Jev does not rank them.
 */
const teamIssues = createSwrCache<Item[]>({
  freshMs: 5 * 60_000,
  maxAgeMs: 60 * 60_000,
})

async function trackedRepoNames(db: Database): Promise<string[]> {
  const tracked = await db
    .select({ fullName: repos.fullName })
    .from(repos)
    .where(eq(repos.tracked, true))
  return tracked.map((row) => row.fullName).sort()
}

/** Every open issue of the tracked repos, or only each repo's `max` most recently updated. */
async function trackedIssues(db: Database, max?: number): Promise<Item[]> {
  const names = await trackedRepoNames(db)
  return teamIssues.get(`${max ?? "all"}:${names.join(",")}`, async () => {
    const octokit = await getOctokit()
    const fetched = await Promise.all(
      names.map((name) => fetchRepoIssues(octokit, name, max))
    )
    return fetched.flat().map(({ repo, issue }) => teamIssueToItem(repo, issue))
  })
}

/**
 * The issues a page needs. The first pages never wait for every issue: the
 * most recently updated ones overall are among each repo's first GitHub page.
 */
function issuesFor(
  db: Database,
  page: { offset: number; limit: number }
): Promise<Item[]> {
  const all = trackedIssues(db)
  if (page.offset + page.limit > ISSUES_PER_PAGE) return all
  return Promise.any([all, trackedIssues(db, ISSUES_PER_PAGE)])
}

/** The issue among those already read from GitHub; never reads it again. */
async function findTrackedIssue(
  db: Database,
  key: string
): Promise<Item | undefined> {
  const names = (await trackedRepoNames(db)).join(",")
  const find = (issues: Item[] | undefined) =>
    issues?.find((entry) => entry.key === key)
  return (
    find(teamIssues.peek(`all:${names}`)) ??
    find(teamIssues.peek(`${ISSUES_PER_PAGE}:${names}`))
  )
}

/**
 * Every open issue of the tracked repos, the most recently updated first. An
 * issue already in the inbox keeps its item.
 */
export async function listAllIssues(
  repo?: string,
  page: { offset: number; limit: number } = { offset: 0, limit: ISSUES_PAGE },
  source: (
    db: Database,
    page: { offset: number; limit: number }
  ) => Promise<Item[]> = issuesFor
): Promise<IssuePage> {
  const db = await getDb()
  const [fetched, known] = await Promise.all([
    source(db, page),
    knownOpenItems(db, "Issue", repo),
  ])
  return pageOf(mergeIssues(known, fetched, repo), page)
}

/**
 * What « Toutes les PR » and « Toutes les issues » count in the sidebar. The
 * issues count is null until every issue was read from GitHub once.
 */
export async function countBrowse(): Promise<{
  pulls: number
  issues: number | null
}> {
  const db = await getDb()
  const names = await trackedRepoNames(db)
  const [[team], [own]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamPulls)
      .where(inArray(teamPulls.repoFullName, names)),
    // The team snapshot leaves out the viewer's own PRs.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(
        and(
          inArray(items.repoFullName, names),
          eq(items.kind, "PullRequest"),
          eq(items.state, "OPEN"),
          eq(items.view, "mine")
        )
      ),
  ])
  const issues = teamIssues.peek(`all:${names.join(",")}`)
  return {
    pulls: team.count + own.count,
    issues: issues
      ? mergeIssues(await knownOpenItems(db, "Issue"), issues).length
      : null,
  }
}

/** Reads the issues from GitHub ahead of time, so that « Toutes les issues » opens at once. */
export async function warmAllIssues() {
  await trackedIssues(await getDb())
}

/**
 * Every open PR of the tracked repos: the viewer's, and the team's ones. A PR
 * already in the inbox keeps its item, with its priority and its review state.
 */
export async function listAllPulls(
  repo?: string,
  sort: SortOrder = "priority"
): Promise<InboxItem[]> {
  const db = await getDb()
  const [team, known, viewer, preferences] = await Promise.all([
    db
      .select()
      .from(teamPulls)
      .where(repo ? eq(teamPulls.repoFullName, repo) : undefined),
    knownOpenItems(db, "PullRequest", repo),
    getViewer(),
    getPreferences(db),
  ])
  const t = messagesFor(preferences.language)
  const teamKeys = new Set(team.map((pull) => pull.key))
  const scores = await readScores(db, [
    ...team.map((pull) => pull.key),
    ...known.keys(),
  ])
  // An inbox item that left the active folders keeps no triage: the team score fills in.
  const withCachedScore = (item: InboxItem): InboxItem => {
    if (item.jevUrgency !== null) return item
    const scored = withJevScore(item, scores.get(item.key), t)
    return { ...item, ...scored, jevUrgency: jevUrgencyOf(scored) }
  }
  const all: InboxItem[] = [
    ...team.map((pull) => {
      const item = known.get(pull.key)
      // Only the viewer's own PRs get a readiness in the inbox: the team's fills in.
      if (item)
        return withCachedScore({
          ...item,
          readiness: item.readiness ?? pull.readiness,
        })
      const synthetic = withJevScore(
        teamPullToItem(pull, viewer.login),
        scores.get(pull.key),
        t
      )
      return {
        ...synthetic,
        slackDiscussions: null,
        inInbox: false,
        jevUrgency: jevUrgencyOf(synthetic),
      }
    }),
    // The team snapshot leaves out the viewer's own PRs.
    ...[...known.values()]
      .filter((item) => !teamKeys.has(item.key) && item.view === "mine")
      .map(withCachedScore),
  ]
  const size = (item: Item) =>
    item.additions === null
      ? Number.POSITIVE_INFINITY
      : item.additions + (item.deletions ?? 0)
  // Jev's urgency first; unscored PRs follow, the most recent first.
  const urgency = (item: InboxItem) => item.jevUrgency ?? -1
  return all.sort((a, b) =>
    sort === "size"
      ? size(a) - size(b)
      : urgency(b) - urgency(a) || b.updatedAt.getTime() - a.updatedAt.getTime()
  )
}

/** Shows Jev's level on a team PR like on an inbox item, without a priority score. */
function withJevScore(item: Item, score: Score | undefined, t: Messages): Item {
  if (!score) return item
  const urgency = trustedUrgency(score)
  return {
    ...item,
    aiUrgency: score.urgency,
    aiConfidence: score.confidence,
    needsCheck: urgency === null,
    priorityReasons:
      urgency === null
        ? []
        : [
            {
              label: t.server.priority.ai(
                t.server.priority.urgencyLevels[Math.round(urgency)]
              ),
              weight: Math.round(urgency * 10),
              hint: t.server.priority.aiHint,
            },
          ],
  }
}

/** Folders whose items wait for the viewer: the "pings" shown on the logo and tab. */
export const PING_FOLDERS: Folder[] = ["review", "awaiting"]

export async function countPings(): Promise<number> {
  const db = await getDb()
  const [counts, [ownAwaiting]] = await Promise.all([
    countFolders(),
    // A reply awaited on the viewer's own PR pings too, though it sits in « Mes PR ».
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .innerJoin(repos, eq(repos.fullName, items.repoFullName))
      .where(
        and(
          eq(repos.tracked, true),
          folderCondition("mine", new Date()),
          eq(items.awaitingMe, true)
        )
      ),
  ])
  return (
    PING_FOLDERS.reduce((total, folder) => total + counts[folder], 0) +
    ownAwaiting.count
  )
}

export async function countFolders(): Promise<Record<Folder, number>> {
  const db = await getDb()
  const now = new Date()
  const entries = await Promise.all(
    FOLDERS.map(async (folder) => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(items)
        .innerJoin(repos, eq(repos.fullName, items.repoFullName))
        .where(and(eq(repos.tracked, true), folderCondition(folder, now)))
      return [folder, row.count] as const
    })
  )
  return Object.fromEntries(entries) as Record<Folder, number>
}

async function getItem(key: string): Promise<Item> {
  const db = await getDb()
  const item = (await db.select().from(items).where(eq(items.key, key))).at(0)
  if (item) return item
  // A teammate's PR opened from « Toutes les PR » or the team view.
  const pull = (
    await db.select().from(teamPulls).where(eq(teamPulls.key, key))
  ).at(0)
  if (pull) return teamPullToItem(pull, (await getViewer()).login)
  // A teammate's issue opened from « Toutes les issues ».
  const issue = await findTrackedIssue(db, key)
  if (issue) return issue
  const { t } = await getMessages(db)
  throw new Error(t.server.errors.itemNotFound(key))
}

const HOUR_MS = 60 * 60 * 1000

/**
 * What the detail panel reads from GitHub, kept stale-while-revalidate: an item
 * opened again shows at once what it showed, while GitHub is asked behind.
 */
const conversations = createSwrCache<Conversation | null>({
  freshMs: 20_000,
  maxAgeMs: 6 * HOUR_MS,
})
const checksCache = createSwrCache<PullChecks>({
  freshMs: 20_000,
  maxAgeMs: 6 * HOUR_MS,
})

function cachedConversation(
  octokit: Octokit,
  ref: { owner: string; repo: string; number: number },
  kind: "PullRequest" | "Issue"
) {
  return conversations.get(
    `${kind}:${ref.owner}/${ref.repo}#${ref.number}`,
    () => fetchConversation(octokit, { ...ref, kind })
  )
}

/** A change made from the app shows on the next read, not after the cache ages. */
function forgetConversation(key: string) {
  conversations.invalidate(`PullRequest:${key}`)
  conversations.invalidate(`Issue:${key}`)
}

export async function getConversation(key: string) {
  const item = await getItem(key)
  const ref = parseSubjectKey(key)
  if (!ref || (item.kind !== "PullRequest" && item.kind !== "Issue")) {
    return { item, conversation: null }
  }
  const octokit = await getOctokit()
  const conversation = await cachedConversation(octokit, ref, item.kind)
  if (item.threadId && item.unread) {
    await octokit.rest.activity.markThreadAsRead({
      thread_id: Number(item.threadId),
    })
    const db = await getDb()
    await db.update(items).set({ unread: false }).where(eq(items.key, key))
  }
  return { item, conversation }
}

export async function markDone(keys: string[], done: boolean) {
  if (keys.length === 0) return
  const db = await getDb()
  const rows = await db.select().from(items).where(inArray(items.key, keys))
  await db
    .update(items)
    .set({
      doneAt: done ? new Date() : null,
      snoozedUntil: null,
      autoDoneReason: null,
    })
    .where(inArray(items.key, keys))
  if (!done) return
  const now = new Date()
  await recordActivity(
    db,
    rows.flatMap((item) =>
      item.doneAt ? [] : viewTransitions(item.key, item.view, "other", now)
    )
  )
  const octokit = await getOctokit()
  const threads = rows.flatMap((item) => (item.threadId ? [item.threadId] : []))
  for (let start = 0; start < threads.length; start += 8) {
    await Promise.all(
      threads.slice(start, start + 8).map((threadId) =>
        octokit.rest.activity.markThreadAsDone({
          thread_id: Number(threadId),
        })
      )
    )
  }
}

export async function snooze(keys: string[], until: Date | null) {
  if (keys.length === 0) return
  const db = await getDb()
  await db
    .update(items)
    .set({ snoozedUntil: until })
    .where(inArray(items.key, keys))
}

async function isInInbox(key: string): Promise<boolean> {
  const db = await getDb()
  const rows = await db
    .select({ key: items.key })
    .from(items)
    .where(eq(items.key, key))
  return rows.length > 0
}

/** The conversation of an issue or PR outside the inbox, for « Mes issues ». */
export async function getWorkConversation(
  key: string,
  kind: "Issue" | "PullRequest"
) {
  const ref = parseSubjectKey(key)
  if (!ref)
    throw new Error((await getMessages()).t.server.errors.itemUnreadable(key))
  return cachedConversation(await getOctokit(), ref, kind)
}

async function refreshItem(key: string) {
  if (!(await isInInbox(key))) return
  const [octokit, viewer, item] = await Promise.all([
    getOctokit(),
    getViewer(),
    getItem(key),
  ])
  await enrichItems(await getDb(), octokit, viewer, [item])
}

export type ReplyTarget =
  { type: "conversation" } | { type: "thread"; commentDatabaseId: number }

export async function reply(key: string, body: string, target: ReplyTarget) {
  const ref = parseSubjectKey(key)
  if (!ref) throw new Error((await getMessages()).t.server.errors.cannotReply)
  const octokit = await getOctokit()
  const { data } =
    target.type === "thread"
      ? await octokit.rest.pulls.createReplyForReviewComment({
          owner: ref.owner,
          repo: ref.repo,
          pull_number: ref.number,
          comment_id: target.commentDatabaseId,
          body,
        })
      : await octokit.rest.issues.createComment({
          owner: ref.owner,
          repo: ref.repo,
          issue_number: ref.number,
          body,
        })
  forgetConversation(key)
  // Issues of « Mes issues » may not be in the inbox.
  if (await isInInbox(key)) await refreshItem(key)
  return { url: data.html_url }
}

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

export async function submitReview(
  key: string,
  event: ReviewEvent,
  body: string
) {
  const ref = parseSubjectKey(key)
  if (!ref) throw new Error((await getMessages()).t.server.errors.cannotReview)
  const octokit = await getOctokit()
  const { data } = await octokit.rest.pulls.createReview({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.number,
    event,
    body: body || undefined,
  })
  forgetConversation(key)
  await refreshItem(key)
  return { url: data.html_url }
}

/** The Slack message offered after a review, and where it would go. */
export async function getReviewNotice(key: string, event: ReviewEvent) {
  const db = await getDb()
  const [item, preferences] = await Promise.all([
    getItem(key),
    getPreferences(db),
  ])
  const channel = normalizeChannel(preferences.reviewNoticeChannel)
  if (
    !preferences.reviewNoticeEnabled ||
    !slackEnabled() ||
    item.number === null
  )
    return { enabled: false as const }
  const [author, lookup] = await Promise.all([
    item.author
      ? getOctokit()
          .then((octokit) =>
            octokit.rest.users.getByUsername({ username: item.author! })
          )
          .then(({ data }) => ({ login: data.login, name: data.name ?? null }))
          .catch(() => ({ login: item.author!, name: null }))
      : null,
    db
      .select()
      .from(slackLookups)
      .where(eq(slackLookups.itemKey, key))
      .then((rows) => rows.at(0)),
  ])
  // The PR's own thread in the channel, when the Slack search found one.
  const thread = (lookup?.discussions ?? []).find(
    (discussion) =>
      normalizeChannel(discussion.channel) === channel &&
      discussion.match !== "title"
  )
  return {
    enabled: true as const,
    channel,
    threadPermalink: thread?.permalink ?? null,
    author,
    message: draftReviewNotice(
      {
        event,
        repoFullName: item.repoFullName,
        number: item.number,
        url: item.htmlUrl,
        author: item.author,
        inThread: Boolean(thread),
      },
      messagesFor(preferences.language)
    ),
  }
}

/** Posts the review notice as the user, in the PR's thread or the channel. */
export async function sendReviewNotice(input: {
  message: string
  threadPermalink: string | null
  /** A reply in the PR's thread also shows in the channel, like Slack's « Also send to ». */
  broadcast: boolean
  mentions: NoticeMention[]
}) {
  const db = await getDb()
  const preferences = await getPreferences(db)
  const thread = input.threadPermalink
    ? parsePermalink(input.threadPermalink)
    : null
  const config = await resolveAgentConfig(db)
  const tools = [
    ...slackSendTools(config.kind),
    ...(config.kind === "claude"
      ? [
          "mcp__claude_ai_Slack__slack_search_users",
          "mcp__claude_ai_Slack__slack_search_channels",
        ]
      : []),
  ]
  const answer = await runAgent(
    {
      prompt: buildNoticePrompt(
        thread
          ? { thread, broadcast: input.broadcast }
          : { channel: normalizeChannel(preferences.reviewNoticeChannel) },
        input.message,
        input.mentions,
        tools
      ),
      schema: REPLY_JSON_SCHEMA,
      allowedTools: tools,
      timeoutMs: 2 * 60_000,
    },
    config
  )
  return parseReply(answer, messagesFor(preferences.language))
}

export async function listRepos() {
  const db = await getDb()
  const rows = await db
    .select({
      fullName: repos.fullName,
      tracked: repos.tracked,
      addedManually: repos.addedManually,
      active: sql<number>`count(${items.key}) filter (where ${items.doneAt} is null and ${items.view} <> 'other')::int`,
    })
    .from(repos)
    .leftJoin(items, eq(items.repoFullName, repos.fullName))
    .groupBy(repos.fullName)
    .orderBy(repos.fullName)
  return rows
}

export async function setRepoTracked(fullName: string, tracked: boolean) {
  const db = await getDb()
  await db
    .insert(repos)
    .values({ fullName, tracked, addedManually: true })
    .onConflictDoUpdate({ target: repos.fullName, set: { tracked } })
}

const REPO_CACHE_MS = 10 * 60 * 1000
let accessibleRepos: {
  at: number
  repos: Promise<{ fullName: string; private: boolean }[]>
} | null = null

/** Every repository the viewer can access, cached for a few minutes. */
export function listAccessibleRepos() {
  if (!accessibleRepos || Date.now() - accessibleRepos.at > REPO_CACHE_MS) {
    accessibleRepos = {
      at: Date.now(),
      repos: getOctokit()
        .then((octokit) =>
          octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
            per_page: 100,
            sort: "pushed",
          })
        )
        .then((list) =>
          list.map((repo) => ({
            fullName: repo.full_name,
            private: repo.private,
          }))
        ),
    }
    accessibleRepos.repos.catch(() => (accessibleRepos = null))
  }
  return accessibleRepos.repos
}

export type SlackSubjectInput = {
  kind: "PullRequest" | "Issue"
  title: string
  url: string
}

/** `subject` describes an issue of « Mes issues », which is not an inbox item. */
export async function getSlackDiscussions(
  key: string,
  force = false,
  subject?: SlackSubjectInput
) {
  const [db, item] = await Promise.all([
    getDb(),
    getItem(key).catch((error: unknown) => {
      if (subject) return subjectToItem({ key, ...subject })
      throw error
    }),
  ])
  if (!slackEnabled())
    return { enabled: false as const, agent: null, lookup: null }
  const [lookup, preferences] = await Promise.all([
    requestLookup(db, item, { force }),
    getPreferences(db),
  ])
  const discussions = lookup?.discussions ?? []
  const visible = withoutExcludedChannels(
    discussions,
    await slackExclusions(db, preferences.slackExcludedChannels)
  )
  const reads =
    visible.length === 0
      ? []
      : await db
          .select()
          .from(slackReads)
          .where(
            inArray(
              slackReads.permalink,
              visible.map((d) => d.permalink)
            )
          )
  return {
    enabled: true as const,
    agent: getAgentConfig(process.env, preferences).kind,
    lookup: lookup ? { ...lookup, discussions: visible } : null,
    hiddenCount: discussions.length - visible.length,
    /** Permalink → `postedAt` of the newest message read. */
    reads: Object.fromEntries(
      reads.map((read) => [read.permalink, read.readThrough])
    ),
  }
}

/** Marks a Slack thread read up to its newest message, or unread again. */
export async function setSlackRead(
  permalink: string,
  readThrough: string | null
) {
  const db = await getDb()
  if (readThrough === null) {
    await db.delete(slackReads).where(eq(slackReads.permalink, permalink))
    return
  }
  const row = { permalink, readThrough, readAt: new Date() }
  await db
    .insert(slackReads)
    .values(row)
    .onConflictDoUpdate({ target: slackReads.permalink, set: row })
}

export async function replyInSlack(
  key: string,
  permalink: string,
  message: string
) {
  const db = await getDb()
  const { t } = await getMessages(db)
  const thread = parsePermalink(permalink)
  if (!thread) throw new Error(t.server.errors.slackLinkUnreadable)
  const config = await resolveAgentConfig(db)
  const tools = slackSendTools(config.kind)
  const answer = await runAgent(
    {
      prompt: buildReplyPrompt(thread, message, tools),
      schema: REPLY_JSON_SCHEMA,
      allowedTools: tools,
      timeoutMs: 90_000,
    },
    config
  )
  const result = parseReply(answer, t)
  await appendReply(db, key, permalink, message)
  return result
}

/** Everything the settings page shows: editable preferences and `.env` facts. */
export async function getSettings() {
  const db = await getDb()
  const [preferences, lookups, viewer] = await Promise.all([
    getPreferences(db),
    db.select({ discussions: slackLookups.discussions }).from(slackLookups),
    getViewer().catch(() => null),
  ])

  // One entry per channel id: the agent names a DM differently from one search to the next.
  const channels = new Map<
    string,
    { names: Map<string, number>; threads: number }
  >()
  for (const { discussions } of lookups) {
    for (const discussion of discussions) {
      const name = normalizeChannel(discussion.channel)
      const id = channelIdOf(discussion.permalink) ?? name
      const channel = channels.get(id) ?? { names: new Map(), threads: 0 }
      channel.threads += 1
      channel.names.set(name, (channel.names.get(name) ?? 0) + 1)
      channels.set(id, channel)
    }
  }

  const envAgent = getAgentConfig(process.env)
  return {
    preferences,
    slackChannels: [...channels]
      .map(([id, channel]) => ({
        id,
        // The name the agent used most often for it.
        name: [...channel.names].sort((a, b) => b[1] - a[1])[0][0],
        names: [...channel.names.keys()],
        threads: channel.threads,
      }))
      .sort((a, b) => b.threads - a.threads),
    env: {
      githubLogin: viewer?.login ?? null,
      githubTokenSource: process.env.GITHUB_TOKEN
        ? "GITHUB_TOKEN"
        : "gh auth token",
      agent: envAgent,
      decisionModel: process.env.AI_DECISION_MODEL ?? "typesafe:jev-latest",
      jevConfigured: Boolean(process.env.TYPESAFE_AI_API_KEY),
      slackSearchEnabled: slackEnabled(),
    },
  }
}

/** « Ne pas déranger », the quiet hours and the sync pace, for the sidebar and the settings. */
export async function getQuietState() {
  const preferences = await getPreferences(await getDb())
  return {
    dndUntil: preferences.dndUntil,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietStart: preferences.quietStart,
    quietEnd: preferences.quietEnd,
    syncIntervalSeconds: preferences.syncIntervalSeconds,
    githubIntervalS: getSyncStatus().githubIntervalS,
  }
}

export async function savePreferences(
  patch: z.infer<typeof preferencesPatchSchema>
) {
  const next = await updatePreferences(await getDb(), patch)
  // A new interval applies to the sync already waiting, not the one after.
  if (patch.syncIntervalSeconds !== undefined) await rescheduleSync()
  return next
}

/** In-flight runs, keyed by `itemKey:length`. */
const summarising = new Map<string, Promise<void>>()
const runKey = (key: string, length: SummaryLength) => `${key}:${length}`

async function readSummary(key: string) {
  const db = await getDb()
  const [item, rows, preferences] = await Promise.all([
    getItem(key),
    db.select().from(summaries).where(eq(summaries.itemKey, key)),
    getPreferences(db),
  ])
  const byLength = Object.fromEntries(
    SUMMARY_LENGTHS.map((length) => {
      const summary = rows.find((row) => row.length === length) ?? null
      return [
        length,
        summary && {
          ...summary,
          // New GitHub activity since the summary was written.
          outdated: item.updatedAt > summary.sourceUpdatedAt,
        },
      ]
    })
  ) as Record<SummaryLength, (Summary & { outdated: boolean }) | null>
  return {
    defaultLength: preferences.summaryLength,
    summaries: byLength,
    generating: SUMMARY_LENGTHS.filter((length) =>
      summarising.has(runKey(key, length))
    ),
  }
}

export function getSummary(key: string) {
  return readSummary(key)
}

/** Summarises with the main AI and stores the result; joins a run in progress. */
/** What the AI reads about an item: its facts, GitHub conversation and Slack threads. */
async function summaryContext(key: string) {
  const db = await getDb()
  const item = await getItem(key)
  const ref = parseSubjectKey(key)
  if (!ref || (item.kind !== "PullRequest" && item.kind !== "Issue")) {
    const { t } = await getMessages(db)
    throw new Error(t.server.errors.summaryNeedsSubject)
  }
  const [octokit, viewer, preferences, lookup] = await Promise.all([
    getOctokit(),
    getViewer(),
    getPreferences(db),
    db
      .select()
      .from(slackLookups)
      .where(
        and(eq(slackLookups.itemKey, key), eq(slackLookups.status, "done"))
      )
      .then((rows) => rows.at(0)),
  ])
  const conversation = await fetchConversation(octokit, {
    ...ref,
    kind: item.kind,
  })
  const slack = withoutExcludedChannels(
    lookup?.discussions ?? [],
    await slackExclusions(db, preferences.slackExcludedChannels)
  )
  const config = getAgentConfig(process.env, preferences, "smart")
  return {
    item,
    ref,
    octokit,
    viewer,
    config,
    language: preferences.language,
    input: buildSummaryInput(item, conversation, slack),
  }
}

const insightRuns = new Map<string, Promise<unknown>>()
/** KPIs younger than this are shown without checking GitHub again. */
const INSIGHTS_TTL_MS = 20 * 60_000

/**
 * Jev's KPIs for a PR, recomputed only when the PR changed (conversation,
 * files, CI) or when asked. `available` is false without a decision model.
 */
export async function getPullInsights(
  key: string,
  force = false,
  subject?: SlackSubjectInput
) {
  const model = getDecisionModel()
  if (!model)
    return { available: false as const, insights: [], createdAt: null }
  const db = await getDb()
  const { t } = await getMessages(db)
  // An issue of « Mes issues » may be known only by what the page sends.
  const item = await getItem(key).catch((error: unknown) => {
    if (subject) return subjectToItem({ key, ...subject })
    throw error
  })
  const ref = parseSubjectKey(key)
  if (!ref || (item.kind !== "PullRequest" && item.kind !== "Issue"))
    throw new Error(t.server.errors.insightsNeedSubject)
  const cached = (
    await db.select().from(pullInsights).where(eq(pullInsights.itemKey, key))
  ).at(0)
  // A fresh result is served as is: no GitHub call, nothing for Jev.
  if (
    cached &&
    !force &&
    Date.now() - cached.createdAt.getTime() < INSIGHTS_TTL_MS
  )
    return {
      available: true as const,
      insights: cached.insights,
      createdAt: cached.createdAt,
    }
  const octokit = await getOctokit()
  let state:
    | ReturnType<typeof buildInsightState>
    | ReturnType<typeof buildIssueInsightState>
  if (item.kind === "PullRequest") {
    const [conversation, files] = await Promise.all([
      fetchConversation(octokit, { ...ref, kind: "PullRequest" }),
      fetchPullFiles(octokit, ref),
    ])
    if (!conversation) throw new Error(t.server.errors.pullConversationNotFound)
    state = buildInsightState(conversation, files.files, {
      ciState: item.ciState,
      reviewDecision: item.reviewDecision,
    })
  } else {
    const [conversation, viewer] = await Promise.all([
      fetchConversation(octokit, { ...ref, kind: "Issue" }),
      getViewer(),
    ])
    if (!conversation)
      throw new Error(t.server.errors.issueConversationNotFound)
    state = buildIssueInsightState(conversation, item.labels, viewer.login)
  }
  const specs =
    item.kind === "PullRequest" ? pullInsightSpecs(t) : issueInsightSpecs(t)
  const hash = insightHash(state)
  // Past the TTL, an unchanged item keeps its KPIs: Jev is only asked again on a change.
  if (cached && cached.hash === hash && !force) {
    await db
      .update(pullInsights)
      .set({ createdAt: new Date() })
      .where(eq(pullInsights.itemKey, key))
    return {
      available: true as const,
      insights: cached.insights,
      createdAt: new Date(),
    }
  }
  // Two panels opening the same PR share one Jev call.
  const run =
    insightRuns.get(key) ??
    computeInsights(model, state, specs).then(async (insights) => {
      const row = { itemKey: key, hash, insights, createdAt: new Date() }
      await db
        .insert(pullInsights)
        .values(row)
        .onConflictDoUpdate({ target: pullInsights.itemKey, set: row })
      return row
    })
  insightRuns.set(key, run)
  try {
    const row = (await run) as typeof pullInsights.$inferSelect
    return {
      available: true as const,
      insights: row.insights,
      createdAt: row.createdAt,
    }
  } finally {
    insightRuns.delete(key)
  }
}

export async function getSummaryRead(key: string) {
  const db = await getDb()
  const row = (
    await db.select().from(summaryReads).where(eq(summaryReads.itemKey, key))
  ).at(0)
  return { readAt: row?.readAt ?? null }
}

export async function setSummaryRead(key: string, read: boolean) {
  const db = await getDb()
  if (!read) {
    await db.delete(summaryReads).where(eq(summaryReads.itemKey, key))
    return { readAt: null }
  }
  const row = { itemKey: key, readAt: new Date() }
  await db
    .insert(summaryReads)
    .values(row)
    .onConflictDoUpdate({ target: summaryReads.itemKey, set: row })
  return { readAt: row.readAt }
}

export async function getChat(key: string) {
  const db = await getDb()
  const row = (
    await db.select().from(itemChats).where(eq(itemChats.itemKey, key))
  ).at(0)
  return { messages: row?.messages ?? [] }
}

export async function clearChat(key: string) {
  const db = await getDb()
  await db.delete(itemChats).where(eq(itemChats.itemKey, key))
  return { messages: [] }
}

/** Asks the AI a question about the item, with the earlier exchanges, and keeps both. */
export async function askAboutItem(key: string, question: string) {
  const db = await getDb()
  const [
    { item, ref, octokit, viewer, config, language, input },
    { messages },
  ] = await Promise.all([summaryContext(key), getChat(key)])
  const isPull = item.kind === "PullRequest"
  // Everything the panel shows next to the conversation, so the answer matches it.
  const [diff, kpis, project, uat] = await Promise.all([
    isPull
      ? fetchPullFiles(octokit, ref).then(({ files }) => formatDiff(files))
      : null,
    db
      .select()
      .from(pullInsights)
      .where(eq(pullInsights.itemKey, key))
      .then((rows) => rows.at(0)?.insights ?? []),
    getProjectFields(key).catch(() => null),
    isPull ? getUatStatus(key).catch(() => null) : null,
  ])
  const facts = formatItemFacts({
    insights: kpis,
    specs: isPull
      ? pullInsightSpecs(messagesFor(language))
      : issueInsightSpecs(messagesFor(language)),
    project: project && {
      title: project.projectTitle,
      status: project.status,
      priority: project.priority,
      via: project.via?.number ?? null,
    },
    uat,
  })
  const answer = await runAgent(
    {
      prompt: buildChatPrompt(viewer.login, language),
      input: buildChatInput(input, facts, diff, messages, question),
      schema: chatJsonSchema(language),
      allowedTools: [],
      timeoutMs: 3 * 60_000,
    },
    config
  )
  const now = new Date()
  const next: ChatMessage[] = [
    ...messages,
    { role: "user", content: question, at: now.toISOString() },
    {
      role: "assistant",
      content: parseChatAnswer(answer),
      at: new Date().toISOString(),
    },
  ]
  await db
    .insert(itemChats)
    .values({ itemKey: key, messages: next, updatedAt: now })
    .onConflictDoUpdate({
      target: itemChats.itemKey,
      set: { messages: next, updatedAt: now },
    })
  return { messages: next }
}

export async function generateSummary(key: string, length: SummaryLength) {
  const running = summarising.get(runKey(key, length))
  if (running) {
    await running
    return readSummary(key)
  }
  const run = (async () => {
    const db = await getDb()
    const { item, viewer, input, config, language } = await summaryContext(key)
    const answer = await runAgent(
      {
        prompt: buildSummaryPrompt(viewer.login, language, length),
        input,
        schema: SUMMARY_JSON_SCHEMA,
        allowedTools: [],
        timeoutMs: 3 * 60_000,
      },
      config
    )
    const row = {
      itemKey: key,
      length,
      content: parseSummary(answer),
      model: config.model ?? AGENT_LABEL[config.kind],
      sourceUpdatedAt: item.updatedAt,
      createdAt: new Date(),
    }
    await db
      .insert(summaries)
      .values(row)
      .onConflictDoUpdate({
        target: [summaries.itemKey, summaries.length],
        set: row,
      })
  })()
  summarising.set(runKey(key, length), run)
  try {
    await run
  } finally {
    summarising.delete(runKey(key, length))
  }
  return readSummary(key)
}

export async function getAttention(afterId: number | null) {
  const db = await getDb()
  const preferences = await getPreferences(db)
  // Muted, the events are skipped rather than kept: nothing replays afterwards.
  if (doNotDisturb(preferences).muted) return readAttention(db, afterId, [])
  // The daily recap has its own switch, so older saved kinds still get it.
  const kinds = [
    ...(preferences.notifyEnabled
      ? preferences.notifyKinds.filter((kind) => kind !== "recap")
      : []),
    ...(preferences.recapEnabled ? (["recap"] as const) : []),
  ]
  return readAttention(db, afterId, kinds)
}

export async function getPullFiles(key: string, sinceReview = false) {
  const ref = parseSubjectKey(key)
  const item = await getItem(key)
  if (!ref || item.kind !== "PullRequest") {
    throw new Error((await getMessages()).t.server.errors.filesNeedPull)
  }
  const since =
    sinceReview && item.reviewedOid && item.headOid
      ? { base: item.reviewedOid, head: item.headOid }
      : undefined
  return fetchPullFiles(await getOctokit(), ref, since)
}

async function pullRef(key: string) {
  const ref = parseSubjectKey(key)
  if (!ref) throw new Error((await getMessages()).t.server.errors.notAPull)
  return ref
}

export async function getMergeInfo(key: string) {
  const { t } = await getMessages()
  return fetchMergeInfo(await getOctokit(), await pullRef(key), t)
}

export async function merge(
  key: string,
  method: MergeMethod,
  deleteBranch: boolean
) {
  const { t } = await getMessages()
  const result = await mergePull(
    await getOctokit(),
    await pullRef(key),
    { method, deleteBranch },
    t
  )
  forgetConversation(key)
  checksCache.invalidate(key)
  await refreshItem(key)
  return result
}

export async function getChecks(key: string) {
  const ref = await pullRef(key)
  return checksCache.get(key, async () => fetchChecks(await getOctokit(), ref))
}

export async function rerunChecks(key: string) {
  const { t } = await getMessages()
  const runs = await rerunFailedJobs(await getOctokit(), await pullRef(key), t)
  checksCache.invalidate(key)
  // The new runs take a few seconds to replace the failed status.
  setTimeout(() => void refreshItem(key).catch(() => undefined), 15_000)
  return { runs }
}

/** Every open team PR, the stuck ones first: the page shows the healthy ones on demand. */
export async function listTeam() {
  const db = await getDb()
  const [rows, viewer, preferences] = await Promise.all([
    db
      .select()
      .from(teamPulls)
      .orderBy(
        sql`cardinality(${teamPulls.problems}) = 0`,
        asc(teamPulls.createdAt)
      ),
    getViewer(),
    getPreferences(db),
  ])
  return {
    pulls: rows,
    total: rows.length,
    viewerLogin: viewer.login,
    staleDays: preferences.teamStaleDays,
  }
}

export async function countTeamProblems(): Promise<number> {
  const db = await getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teamPulls)
    .where(sql`cardinality(${teamPulls.problems}) > 0`)
  return row.count
}

/** Adds the viewer as reviewer; the next sync brings the PR into « À reviewer ». */
export async function takeReview(key: string) {
  const ref = await pullRef(key)
  const [octokit, viewer] = await Promise.all([getOctokit(), getViewer()])
  await octokit.rest.pulls.requestReviewers({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.number,
    reviewers: [viewer.login],
  })
  void syncNow({ forceSearch: true })
}

export async function getReviewerOptions(key: string) {
  const [octokit, viewer] = await Promise.all([getOctokit(), getViewer()])
  return fetchReviewerOptions(
    octokit,
    await pullRef(key),
    viewer.login,
    await getLanguage()
  )
}

/** Leaves exactly `wanted` as requested reviewers, then updates the local copies. */
export async function setReviewers(key: string, wanted: string[]) {
  const ref = await pullRef(key)
  const [octokit, viewer] = await Promise.all([getOctokit(), getViewer()])
  const { requested } = await fetchReviewerOptions(
    octokit,
    ref,
    viewer.login,
    await getLanguage()
  )
  const changes = reviewerChanges(requested, wanted)
  await updateReviewers(octokit, ref, changes)

  const db = await getDb()
  const pull = (
    await db.select().from(teamPulls).where(eq(teamPulls.key, key))
  ).at(0)
  // The team view reads its snapshot: it must not wait for the next team sync.
  if (pull)
    await db
      .update(teamPulls)
      .set({
        reviewers: wanted,
        problems:
          wanted.length > 0
            ? pull.problems.filter((problem) => problem !== "no-reviewer")
            : pull.problems,
      })
      .where(eq(teamPulls.key, key))
  if (await isInInbox(key)) await refreshItem(key)
  // Requesting oneself brings the PR into « À reviewer ».
  if (changes.add.some((id) => id.toLowerCase() === viewer.login.toLowerCase()))
    void syncNow({ forceSearch: true })
  return changes
}

/** « Mes issues »: the issues assigned to the viewer, and the current sprint of the team. */
export async function listIssues() {
  const db = await getDb()
  const [octokit, viewer, preferences, projects] = await Promise.all([
    getOctokit(),
    getViewer(),
    getPreferences(db),
    sprintProjects(),
  ])
  const project = pickSprintProject(projects, preferences.sprintProject)
  let sprint: Sprint | null = null
  let sprintError: string | null = null
  let fieldName: string | undefined
  let sprintSubjects: ScoreSubject[] = []
  if (project)
    try {
      const { subjects, ...fetched } = await fetchSprint(octokit, project)
      sprint = fetched
      sprintSubjects = subjects
      fieldName = fetched.fieldName ?? undefined
    } catch (error) {
      sprintError = error instanceof Error ? error.message : String(error)
    }
  const fetched = await fetchAssignedIssues(octokit, project, fieldName)
  // Jev ranks the lists; tickets it has not scored yet are ranked on the next read.
  const subjects = [...fetched.subjects, ...sprintSubjects]
  const scores = await readScores(
    db,
    subjects.map((subject) => subject.key)
  )
  scoreInBackground(db, subjects, viewer.login)
  const withUrgency = (item: WorkItem): WorkItem => ({
    ...item,
    urgency: trustedUrgency(scores.get(item.key)),
  })
  return {
    viewerLogin: viewer.login,
    projects,
    sprint: sprint && { ...sprint, items: sprint.items.map(withUrgency) },
    sprintError,
    assigned: fetched.items.map(withUrgency),
  }
}

const projectFieldsCache = createSwrCache<
  Awaited<ReturnType<typeof loadProjectFields>>
>({ freshMs: 2 * 60_000, maxAgeMs: 24 * HOUR_MS })

/** Lists the sprint projects and reads the board, so the first panel opened finds them ready. */
export async function warmProjectCaches() {
  const db = await getDb()
  const [octokit, preferences, projects] = await Promise.all([
    getOctokit(),
    getPreferences(db),
    sprintProjects(),
  ])
  const project = pickSprintProject(projects, preferences.sprintProject)
  if (project) await sprintBoard(octokit, project)
}

/** The status and priority of a PR or an issue on the sprint project's board. */
export function getProjectFields(key: string) {
  return projectFieldsCache.get(key, () => loadProjectFields(key))
}

async function loadProjectFields(key: string) {
  const db = await getDb()
  const [octokit, preferences, projects] = await Promise.all([
    getOctokit(),
    getPreferences(db),
    sprintProjects(),
  ])
  const project = pickSprintProject(projects, preferences.sprintProject)
  if (!project) return null
  const board = await sprintBoard(octokit, project)
  const fields = await fetchProjectFields(octokit, key, project, {
    status: "Status",
    priority: board.priorityField?.name ?? "Priority",
  })
  if (!fields) return null
  return {
    ...fields,
    projectId: board.project.id,
    projectTitle: board.project.title,
    statusField: board.statusFieldId
      ? { id: board.statusFieldId, options: board.statuses }
      : null,
    priorityField: board.priorityField,
  }
}

const UAT_TTL_MS = 2 * 60 * 1000
const uatCache = new Map<
  string,
  { at: number; ledger: Promise<Map<string, UatEntry> | null> }
>()

/** uat's history for a repo, read once for every PR opened in the next minutes. */
function uatLedgerOf(octokit: Octokit, repo: string) {
  const cached = uatCache.get(repo)
  if (cached && Date.now() - cached.at < UAT_TTL_MS) return cached.ledger
  const ledger = fetchUatCommits(octokit, repo).then(
    (commits) => commits && uatLedger(commits)
  )
  ledger.catch(() => uatCache.delete(repo))
  uatCache.set(repo, { at: Date.now(), ledger })
  return ledger
}

const uatStatusCache = createSwrCache<UatStatus | null>({
  freshMs: 2 * 60_000,
  maxAgeMs: 24 * HOUR_MS,
})

/** Whether a PR runs on uat; null for a repo without a uat branch. */
export function getUatStatus(key: string): Promise<UatStatus | null> {
  return uatStatusCache.get(key, () => loadUatStatus(key))
}

async function loadUatStatus(key: string): Promise<UatStatus | null> {
  const ref = parseSubjectKey(key)
  if (!ref) return null
  const octokit = await getOctokit()
  const [ledger, pull] = await Promise.all([
    uatLedgerOf(octokit, `${ref.owner}/${ref.repo}`),
    fetchPullForUat(octokit, ref),
  ])
  if (!ledger || !pull) return null
  const status = uatStatus(pull, ledger)
  if (
    status.state !== "deployed" &&
    pull.mergeCommit &&
    (await isOnUat(octokit, ref, pull.mergeCommit))
  )
    return { state: "merged" }
  return status
}

const BODIES_TTL_MS = 10 * 60 * 1000
const bodiesCache = new Map<string, { at: number; body: string }>()

/** Descriptions of the items, from the cache or in one GitHub query for the rest. */
async function bodiesOf(octokit: Octokit, keys: string[]) {
  const fresh = (key: string) => {
    const cached = bodiesCache.get(key)
    return cached && Date.now() - cached.at < BODIES_TTL_MS ? cached : null
  }
  const missing = keys.filter((key) => !fresh(key))
  if (missing.length > 0) {
    const fetched = await fetchBodies(octokit, missing).catch(
      () => new Map<string, string>()
    )
    for (const [key, body] of fetched)
      bodiesCache.set(key, { at: Date.now(), body })
  }
  return new Map(keys.map((key) => [key, fresh(key)?.body ?? null]))
}

/** The AI picks, among the items of a list, those that answer a search in plain words. */
export async function searchItems(input: {
  kind: "PR" | "issue"
  query: string
  candidates: SearchCandidate[]
}): Promise<SearchMatch[]> {
  const db = await getDb()
  const candidates = input.candidates.slice(0, MAX_CANDIDATES)
  const keys = candidates.map((candidate) => candidate.key)
  const [octokit, preferences, summaryRows] = await Promise.all([
    getOctokit(),
    getPreferences(db),
    keys.length > 0
      ? db.select().from(summaries).where(inArray(summaries.itemKey, keys))
      : Promise.resolve([]),
  ])
  const bodies = await bodiesOf(octokit, keys)
  const summaryOf = new Map(
    summaryRows.map((row) => [row.itemKey, row.content.tldr])
  )
  const answer = await runAgent(
    {
      prompt: buildSearchPrompt(input.kind, preferences.language),
      input: buildSearchInput(
        input.query,
        candidates.map((candidate) => ({
          ...candidate,
          body: bodies.get(candidate.key) ?? null,
          summary: summaryOf.get(candidate.key) ?? null,
        }))
      ),
      schema: searchJsonSchema(preferences.language),
      allowedTools: [],
      timeoutMs: 2 * 60_000,
    },
    getAgentConfig(process.env, preferences, "smart")
  )
  return parseSearchAnswer(answer, new Set(keys))
}

export type LinkedIssue = {
  key: string
  number: number
  title: string
  url: string
  state: "OPEN" | "CLOSED"
  assignees: string[]
}

const linkedIssuesCache = createSwrCache<LinkedIssue[]>({
  freshMs: 5 * 60_000,
  maxAgeMs: 24 * HOUR_MS,
})

/** The issues a PR closes, as GitHub's « Development » box links them. */
export function getLinkedIssues(key: string): Promise<LinkedIssue[]> {
  return linkedIssuesCache.get(key, () => loadLinkedIssues(key))
}

async function loadLinkedIssues(key: string): Promise<LinkedIssue[]> {
  const ref = parseSubjectKey(key)
  if (!ref) return []
  const data = await (
    await getOctokit()
  ).graphql<{
    repository: {
      pullRequest: {
        closingIssuesReferences: {
          nodes: {
            number: number
            title: string
            url: string
            state: "OPEN" | "CLOSED"
            repository: { nameWithOwner: string }
            assignees: { nodes: { login: string }[] }
          }[]
        }
      } | null
    } | null
  }>(
    `query ($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          closingIssuesReferences(first: 10) {
            nodes {
              number title url state
              repository { nameWithOwner }
              assignees(first: 5) { nodes { login } }
            }
          }
        }
      }
    }`,
    ref
  )
  return (
    data.repository?.pullRequest?.closingIssuesReferences.nodes ?? []
  ).map((issue) => ({
    key: `${issue.repository.nameWithOwner}#${issue.number}`,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    assignees: issue.assignees.nodes.map((a) => a.login),
  }))
}

export async function moveWorkItem(input: {
  projectId: string
  itemId: string
  fieldId: string
  optionId: string
}) {
  await setItemStatus(await getOctokit(), input)
  // The card may be the PR's own or its issue's: forget every item's fields.
  projectFieldsCache.clear()
}

const MENTIONS_TTL_MS = 10 * 60 * 1000
const mentionsCache = new Map<
  string,
  { at: number; people: { login: string; name: string | null }[] }
>()

/** People who can be @mentioned in a repo: those who can be assigned to it. */
export async function getMentionCandidates(repo: string) {
  const cached = mentionsCache.get(repo)
  if (cached && Date.now() - cached.at < MENTIONS_TTL_MS) return cached.people
  const [owner, name] = repo.split("/")
  const data = await (
    await getOctokit()
  ).graphql<{
    repository: {
      assignableUsers: { nodes: { login: string; name: string | null }[] }
    } | null
  }>(
    `query ($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        assignableUsers(first: 100) { nodes { login name } }
      }
    }`,
    { owner, name }
  )
  const people = (data.repository?.assignableUsers.nodes ?? []).map((user) => ({
    login: user.login,
    name: user.name || null,
  }))
  mentionsCache.set(repo, { at: Date.now(), people })
  return people
}

/** What the viewer did since Monday, in the repos of the tracked owners. */
export async function getWeekSummary() {
  const db = await getDb()
  const [octokit, viewer, tracked] = await Promise.all([
    getOctokit(),
    getViewer(),
    db.select().from(repos).where(eq(repos.tracked, true)),
  ])
  const owners = [
    ...new Set(tracked.map((repo) => repo.fullName.split("/")[0])),
  ]
  return fetchWeekSummary(octokit, viewer.login, owners)
}

export async function getRecap() {
  const db = await getDb()
  const [recap, team, me, preferences] = await Promise.all([
    buildRecap(db),
    readStandup(db, "team"),
    readStandup(db, "me"),
    getPreferences(db),
  ])
  const t = messagesFor(preferences.language)
  return {
    ...recap,
    standups: {
      team: {
        state: team,
        publishBlocker: publishBlocker(team, "team", t),
        enabled: preferences.standupEnabled,
      },
      me: {
        state: me,
        publishBlocker: publishBlocker(me, "me", t),
        enabled: preferences.myStandupEnabled,
      },
    },
    recapTime: preferences.recapTime,
    standupChannel: preferences.standupChannel,
    standupReminder: preferences.standupReminder,
    standupCommands: {
      team: preferences.teamStandupCommand,
      me: preferences.myStandupCommand,
    },
  }
}

export async function postStandup(kind: StandupKind) {
  return publishStandup(await getDb(), kind)
}

export async function runStandup(kind: StandupKind) {
  const db = await getDb()
  void startStandup(db, localDate(new Date()), kind)
  return readStandup(db, kind)
}

export async function markFileViewed(
  pullRequestId: string,
  path: string,
  viewed: boolean
) {
  await setFileViewed(await getOctokit(), pullRequestId, path, viewed)
}

export async function getDashboard() {
  const db = await getDb()
  const [viewer, preferences] = await Promise.all([
    getViewer(),
    getPreferences(db),
  ])
  return buildDashboard(db, viewer, {
    reviewSlaHours: preferences.reviewSlaHours,
  })
}
