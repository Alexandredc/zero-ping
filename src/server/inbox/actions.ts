import { and, desc, eq, gt, isNotNull, isNull, lte, or, sql } from "drizzle-orm"
import { getDb } from "@/server/db/client"
import { items, repos } from "@/server/db/schema"
import type { Item, View } from "@/server/db/schema"
import { getOctokit, getViewer } from "@/server/github/client"
import { fetchConversation } from "@/server/github/conversation"
import { parseSubjectKey } from "@/server/inbox/notifications"
import { enrichItems } from "@/server/inbox/sync"

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

export async function listInbox(
  folder: Folder,
  repo?: string
): Promise<Item[]> {
  const db = await getDb()
  const now = new Date()
  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(repos, eq(repos.fullName, items.repoFullName))
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
  return rows.map((row) => row.item)
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
