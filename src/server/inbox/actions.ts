import type { z } from "zod"
import { and, desc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import { getDb } from "@/server/db/client"
import {
  SUMMARY_LENGTHS,
  items,
  repos,
  slackLookups,
  summaries,
} from "@/server/db/schema"
import type { Item, Summary, SummaryLength, View } from "@/server/db/schema"
import { getOctokit, getViewer } from "@/server/github/client"
import { fetchConversation } from "@/server/github/conversation"
import { fetchPullFiles, setFileViewed } from "@/server/github/pull-files"
import { parseSubjectKey } from "@/server/inbox/notifications"
import { enrichItems } from "@/server/inbox/sync"
import { readAttention } from "@/server/inbox/attention"
import {
  DEFAULT_SUMMARY_MODEL,
  SUMMARY_JSON_SCHEMA,
  buildSummaryInput,
  buildSummaryPrompt,
  parseSummary,
} from "@/server/summary/summarize"
import {
  getPreferences,
  normalizeChannel,
  updatePreferences,
  withoutExcludedChannels,
} from "@/server/preferences"
import type { preferencesPatchSchema } from "@/server/preferences"
import { getAgentConfig, runAgent } from "@/server/agents/runner"
import {
  appendReply,
  requestLookup,
  resolveAgentConfig,
  slackEnabled,
} from "@/server/slack/lookups"
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
}

export async function listInbox(
  folder: Folder,
  repo?: string
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
        : [desc(items.priority), desc(items.updatedAt)])
    )
    .limit(200)
  const { slackExcludedChannels } = await getPreferences(db)
  return rows.map((row) => ({
    ...row.item,
    slackDiscussions: row.slack
      ? withoutExcludedChannels(row.slack, slackExcludedChannels).length
      : null,
  }))
}

/** Folders whose items wait for the viewer: the "pings" shown on the logo and tab. */
export const PING_FOLDERS: Folder[] = ["review", "awaiting"]

export async function countPings(): Promise<number> {
  const counts = await countFolders()
  return PING_FOLDERS.reduce((total, folder) => total + counts[folder], 0)
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
  if (!item) throw new Error(`Élément introuvable : ${key}`)
  return item
}

export async function getConversation(key: string) {
  const item = await getItem(key)
  const ref = parseSubjectKey(key)
  if (!ref || (item.kind !== "PullRequest" && item.kind !== "Issue")) {
    return { item, conversation: null }
  }
  const octokit = await getOctokit()
  const conversation = await fetchConversation(octokit, {
    ...ref,
    kind: item.kind,
  })
  if (item.threadId && item.unread) {
    await octokit.rest.activity.markThreadAsRead({
      thread_id: Number(item.threadId),
    })
    const db = await getDb()
    await db.update(items).set({ unread: false }).where(eq(items.key, key))
  }
  return { item, conversation }
}

export async function markDone(key: string, done: boolean) {
  const db = await getDb()
  const item = await getItem(key)
  await db
    .update(items)
    .set({ doneAt: done ? new Date() : null, snoozedUntil: null })
    .where(eq(items.key, key))
  if (done && item.threadId) {
    const octokit = await getOctokit()
    await octokit.rest.activity.markThreadAsDone({
      thread_id: Number(item.threadId),
    })
  }
}

export async function snooze(key: string, until: Date | null) {
  const db = await getDb()
  await db.update(items).set({ snoozedUntil: until }).where(eq(items.key, key))
}

async function refreshItem(key: string) {
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
  if (!ref) throw new Error("Impossible de répondre à cet élément.")
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
  await refreshItem(key)
  return { url: data.html_url }
}

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

export async function submitReview(
  key: string,
  event: ReviewEvent,
  body: string
) {
  const ref = parseSubjectKey(key)
  if (!ref) throw new Error("Impossible de reviewer cet élément.")
  const octokit = await getOctokit()
  const { data } = await octokit.rest.pulls.createReview({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.number,
    event,
    body: body || undefined,
  })
  await refreshItem(key)
  return { url: data.html_url }
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

export async function getSlackDiscussions(key: string, force = false) {
  const [db, item] = await Promise.all([getDb(), getItem(key)])
  if (!slackEnabled())
    return { enabled: false as const, agent: null, lookup: null }
  const [lookup, preferences] = await Promise.all([
    requestLookup(db, item, { force }),
    getPreferences(db),
  ])
  const discussions = lookup?.discussions ?? []
  const visible = withoutExcludedChannels(
    discussions,
    preferences.slackExcludedChannels
  )
  return {
    enabled: true as const,
    agent: getAgentConfig(process.env, preferences).kind,
    lookup: lookup ? { ...lookup, discussions: visible } : null,
    hiddenCount: discussions.length - visible.length,
  }
}

export async function replyInSlack(
  key: string,
  permalink: string,
  message: string
) {
  const thread = parsePermalink(permalink)
  if (!thread)
    throw new Error(
      "Lien Slack illisible : ouvre le fil dans Slack pour répondre."
    )
  const config = await resolveAgentConfig(await getDb())
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
  const result = parseReply(answer)
  await appendReply(await getDb(), key, permalink, message)
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

  const channels = new Map<string, number>()
  for (const { discussions } of lookups) {
    for (const discussion of discussions) {
      const name = normalizeChannel(discussion.channel)
      channels.set(name, (channels.get(name) ?? 0) + 1)
    }
  }

  const envAgent = getAgentConfig(process.env)
  return {
    preferences,
    slackChannels: [...channels]
      .map(([name, threads]) => ({ name, threads }))
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

export async function savePreferences(
  patch: z.infer<typeof preferencesPatchSchema>
) {
  return updatePreferences(await getDb(), patch)
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

/** Summarises with Claude Code and stores the result; joins a run in progress. */
export async function generateSummary(key: string, length: SummaryLength) {
  const running = summarising.get(runKey(key, length))
  if (running) {
    await running
    return readSummary(key)
  }
  const run = (async () => {
    const db = await getDb()
    const item = await getItem(key)
    const ref = parseSubjectKey(key)
    if (!ref || (item.kind !== "PullRequest" && item.kind !== "Issue")) {
      throw new Error("Seules les PR et les issues peuvent être résumées.")
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
      preferences.slackExcludedChannels
    )
    const config = getAgentConfig(process.env, {
      agentCli: "claude",
      agentModel: preferences.summaryModel ?? DEFAULT_SUMMARY_MODEL,
    })
    const answer = await runAgent(
      {
        prompt: buildSummaryPrompt(viewer.login, length),
        input: buildSummaryInput(item, conversation, slack),
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
      model: config.model ?? "claude",
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
  return readAttention(
    db,
    afterId,
    preferences.notifyEnabled ? preferences.notifyKinds : []
  )
}

export async function getPullFiles(key: string) {
  const ref = parseSubjectKey(key)
  const item = await getItem(key)
  if (!ref || item.kind !== "PullRequest") {
    throw new Error("Seules les PR ont des fichiers modifiés.")
  }
  return fetchPullFiles(await getOctokit(), ref)
}

export async function markFileViewed(
  pullRequestId: string,
  path: string,
  viewed: boolean
) {
  await setFileViewed(await getOctokit(), pullRequestId, path, viewed)
}
