import { eq, inArray } from "drizzle-orm"
import { getDb } from "@/server/db/client"
import {
  items,
  itemChats,
  pullInsights,
  slackLookups,
  teamPulls,
} from "@/server/db/schema"
import type { ChatMessage, Item } from "@/server/db/schema"
import * as live from "@/server/inbox/actions"
import type {
  LinkedIssue,
  ReviewEvent,
  SlackSubjectInput,
} from "@/server/inbox/actions"
import type { PullFiles } from "@/server/github/pull-files"
import type { SearchCandidate, SearchMatch } from "@/server/search/smart-search"
import { MAX_CANDIDATES } from "@/server/search/smart-search"
import { draftReviewNotice } from "@/server/slack/review-notice"
import { getPreferences, normalizeChannel } from "@/server/preferences"
import { teamPullToItem } from "@/server/team/as-item"
import { DEMO_OFFLINE, DEMO_VIEWER, DemoOfflineError } from "./mode"
import {
  DEMO_BOARD,
  DEMO_PEOPLE,
  DEMO_PROJECT,
  DEMO_REPOS,
  demoIssueConversations,
  demoMergeInfo,
  demoPulls,
  demoReviewerOptions,
  demoSprint,
  demoWeek,
  nameOf,
} from "./fixtures"
import { seedDemo } from "./seed"

/**
 * The actions whose live version reads GitHub, Slack or an AI, answered from
 * the demo's fixtures instead. Writes that would leave the machine fail with
 * a clear message; the local ones (done, snooze, read marks) still work.
 */

const globalForDemo = globalThis as unknown as {
  __zeroPingDemo?: Promise<void>
}

/** Seeds the demo database once per server process, dated from its start. */
export function ensureDemoSeed(): Promise<void> {
  globalForDemo.__zeroPingDemo ??= getDb()
    .then((db) => seedDemo(db))
    .catch((error: unknown) => {
      globalForDemo.__zeroPingDemo = undefined
      throw error
    })
  return globalForDemo.__zeroPingDemo
}

const offline = (): never => {
  throw new DemoOfflineError()
}

async function findItem(key: string): Promise<Item> {
  const db = await getDb()
  const item = (await db.select().from(items).where(eq(items.key, key))).at(0)
  if (item) return item
  const pull = (
    await db.select().from(teamPulls).where(eq(teamPulls.key, key))
  ).at(0)
  if (pull) return teamPullToItem(pull, DEMO_VIEWER.login)
  throw new Error(`Élément introuvable : ${key}`)
}

const pullOf = (key: string) =>
  demoPulls(new Date()).find((pull) => pull.key === key)

/** A plain conversation for the subjects the fixtures do not detail. */
function fallbackConversation(
  item: Pick<
    Item,
    "key" | "title" | "htmlUrl" | "kind" | "author" | "updatedAt"
  >
) {
  return {
    kind: item.kind === "Issue" ? ("Issue" as const) : ("PullRequest" as const),
    title: item.title,
    url: item.htmlUrl,
    state: "OPEN",
    description: {
      id: `${item.key}:body`,
      databaseId: null,
      author: item.author,
      authorAvatar: null,
      body: "_Données de démonstration._",
      createdAt: item.updatedAt.toISOString(),
      url: item.htmlUrl,
    },
    entries: [],
    branches:
      item.kind === "PullRequest" ? { head: "feature", base: "main" } : null,
  }
}

async function getConversation(key: string) {
  const item = await findItem(key)
  if (item.kind !== "PullRequest" && item.kind !== "Issue")
    return { item, conversation: null }
  return {
    item,
    conversation: pullOf(key)?.conversation?.() ?? fallbackConversation(item),
  }
}

async function getWorkConversation(key: string, kind: "Issue" | "PullRequest") {
  const known =
    pullOf(key)?.conversation?.() ?? demoIssueConversations(new Date()).get(key)
  if (known) return known
  const work = [
    ...demoSprint(new Date()).sprint.items,
    ...demoSprint(new Date()).assigned,
  ].find((item) => item.key === key)
  return fallbackConversation({
    key,
    title: work?.title ?? key,
    htmlUrl: work?.url ?? "",
    kind,
    author: work?.assignees[0] ?? null,
    updatedAt: new Date(work?.updatedAt ?? Date.now()),
  })
}

async function getPullFiles(
  key: string,
  sinceReview = false
): Promise<PullFiles> {
  const item = await findItem(key)
  if (item.kind !== "PullRequest")
    throw new Error("Seules les PR ont des fichiers modifiés.")
  const files = pullOf(key)?.files ?? []
  return {
    pullRequestId: `PR_${key}`,
    files,
    truncated: false,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
    sinceReview:
      sinceReview && item.reviewedOid && item.headOid
        ? { base: item.reviewedOid, head: item.headOid, commits: 2 }
        : null,
  }
}

async function getChecks(key: string) {
  const known = pullOf(key)?.checks
  if (known) return known
  const item = await findItem(key)
  const passed = item.ciState === "SUCCESS" ? 8 : 6
  return {
    headSha: item.headOid ?? "0000000",
    summary: { passed, failed: 0, pending: 0, skipped: 0, running: [] },
    failed: [],
    rerunnableRuns: [],
  }
}

async function getMergeInfo(key: string) {
  const item = await findItem(key)
  const head =
    pullOf(key)?.conversation?.().branches?.head ?? `feature/${item.number}`
  return demoMergeInfo(item.title, head)
}

async function getReviewerOptions(key: string) {
  return demoReviewerOptions((await findItem(key)).author)
}

async function getProjectFields(key: string) {
  const project = pullOf(key)?.project
  if (!project) return null
  return {
    itemId: `PVTI_${key}`,
    status: project.status,
    priority: project.priority,
    via: project.via
      ? { key: `${key.split("#")[0]}#${project.via}`, number: project.via }
      : null,
    projectId: DEMO_PROJECT.id,
    projectTitle: DEMO_PROJECT.title,
    statusField: { id: DEMO_BOARD.statusFieldId, options: DEMO_BOARD.statuses },
    priorityField: DEMO_BOARD.priorityField,
  }
}

function getUatStatus(key: string) {
  return Promise.resolve(pullOf(key)?.uat ?? null)
}

function getLinkedIssues(key: string): Promise<LinkedIssue[]> {
  const repo = key.split("#")[0]
  return Promise.resolve(
    (pullOf(key)?.linkedIssues ?? []).map((issue) => ({
      ...issue,
      key: `${repo}#${issue.number}`,
      url: `https://github.com/${repo}/issues/${issue.number}`,
      state: "OPEN" as const,
    }))
  )
}

async function listIssues() {
  const { sprint, assigned } = demoSprint(new Date())
  return {
    viewerLogin: DEMO_VIEWER.login,
    projects: [
      {
        owner: DEMO_PROJECT.owner,
        number: DEMO_PROJECT.number,
        title: DEMO_PROJECT.title,
      },
    ],
    sprint,
    sprintError: null,
    assigned,
  }
}

async function getPullInsights(
  key: string,
  _force = false,
  _subject?: SlackSubjectInput
) {
  const db = await getDb()
  const row = (
    await db.select().from(pullInsights).where(eq(pullInsights.itemKey, key))
  ).at(0)
  if (!row) return { available: false as const, insights: [], createdAt: null }
  return {
    available: true as const,
    insights: row.insights,
    createdAt: row.createdAt,
  }
}

/** Every PR and issue was searched by the seed: no lookup is ever started. */
async function getSlackDiscussions(
  key: string,
  _force = false,
  subject?: SlackSubjectInput
) {
  // A sprint ticket outside the seed gets an empty result rather than a search.
  const now = new Date()
  await (
    await getDb()
  )
    .insert(slackLookups)
    .values({
      itemKey: key,
      status: "done",
      discussions: [],
      agent: "claude",
      startedAt: now,
      finishedAt: now,
    })
    .onConflictDoNothing()
  return live.getSlackDiscussions(key, false, subject)
}

async function getReviewNotice(key: string, event: ReviewEvent) {
  const db = await getDb()
  const [item, preferences, slack] = await Promise.all([
    findItem(key),
    getPreferences(db),
    live.getSlackDiscussions(key, false),
  ])
  if (!preferences.reviewNoticeEnabled || item.number === null)
    return { enabled: false as const }
  const channel = normalizeChannel(preferences.reviewNoticeChannel)
  const thread = (slack.lookup?.discussions ?? []).find(
    (discussion) =>
      normalizeChannel(discussion.channel) === channel &&
      discussion.match !== "title"
  )
  return {
    enabled: true as const,
    channel,
    threadPermalink: thread?.permalink ?? null,
    author: item.author
      ? { login: item.author, name: nameOf(item.author) }
      : null,
    message: draftReviewNotice({
      event,
      repoFullName: item.repoFullName,
      number: item.number,
      title: item.title,
      url: item.htmlUrl,
      author: item.author,
    }),
  }
}

async function generateSummary(key: string) {
  const summary = await live.getSummary(key)
  if (Object.values(summary.summaries).every((value) => value === null))
    offline()
  return summary
}

/** A canned answer: the demo never runs an AI. */
async function askAboutItem(key: string, question: string) {
  const db = await getDb()
  const { messages } = await live.getChat(key)
  const now = new Date().toISOString()
  const next: ChatMessage[] = [
    ...messages,
    { role: "user", content: question, at: now },
    {
      role: "assistant",
      content: `${DEMO_OFFLINE} Avec Claude Code ou Codex, la réponse s'appuie sur la conversation GitHub, les fils Slack, le diff et les KPI Jev de l'élément.`,
      at: now,
    },
  ]
  await db
    .insert(itemChats)
    .values({ itemKey: key, messages: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: itemChats.itemKey,
      set: { messages: next, updatedAt: new Date() },
    })
  return { messages: next }
}

/** Words of the query found in a candidate: a stand-in for the AI search. */
export function keywordSearch(input: {
  query: string
  candidates: SearchCandidate[]
}): SearchMatch[] {
  const words = input.query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2)
  return input.candidates.slice(0, MAX_CANDIDATES).flatMap((candidate) => {
    const text = [
      candidate.title,
      candidate.author ?? "",
      ...candidate.labels,
      ...candidate.facts,
    ]
      .join(" ")
      .toLowerCase()
    const found = words.filter((word) => text.includes(word))
    return found.length > 0
      ? [
          {
            key: candidate.key,
            reason: `Contient « ${found.join(" », « ")} ».`,
          },
        ]
      : []
  })
}

async function searchItems(input: {
  kind: "PR" | "issue"
  query: string
  candidates: SearchCandidate[]
}) {
  return keywordSearch(input)
}

/** Marks items done locally; GitHub's notification threads are left alone. */
async function markDone(keys: string[], done: boolean) {
  if (keys.length === 0) return
  const db = await getDb()
  await db
    .update(items)
    .set({
      doneAt: done ? new Date() : null,
      snoozedUntil: null,
      autoDoneReason: null,
    })
    .where(inArray(items.key, keys))
}

export const demoActions = {
  getConversation,
  getWorkConversation,
  getPullFiles,
  getChecks,
  getMergeInfo,
  getReviewerOptions,
  getProjectFields,
  getUatStatus,
  getLinkedIssues,
  listIssues,
  getPullInsights,
  getSlackDiscussions,
  getReviewNotice,
  generateSummary,
  askAboutItem,
  searchItems,
  markDone,
  getWeekSummary: () => Promise.resolve(demoWeek(new Date())),
  getMentionCandidates: (_repo: string) =>
    Promise.resolve(DEMO_PEOPLE.map(({ login, name }) => ({ login, name }))),
  listAccessibleRepos: () =>
    Promise.resolve(
      [...DEMO_REPOS, "acme/mobile", "acme/docs"].map((fullName) => ({
        fullName,
        private: true,
      }))
    ),
  getSettings: async () => {
    const settings = await live.getSettings()
    return {
      ...settings,
      env: { ...settings.env, jevConfigured: true },
    }
  },
  runStandup: async (kind: "team" | "me") =>
    (await live.getRecap()).standups[kind].state,
  // Everything below would write to GitHub or Slack.
  reply: offline,
  submitReview: offline,
  sendReviewNotice: offline,
  replyInSlack: offline,
  merge: offline,
  rerunChecks: offline,
  takeReview: offline,
  setReviewers: offline,
  moveWorkItem: offline,
  markFileViewed: async (_id: string, _path: string, _viewed: boolean) => {},
  postStandup: offline,
} satisfies Partial<Record<keyof typeof live, unknown>>
