import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm"
import type { Octokit } from "octokit"
import { getDecisionModel } from "@/server/ai/models"
import { triage, triageHash } from "@/server/ai/triage"
import type { Database } from "@/server/db/client"
import { items, repos, settings } from "@/server/db/schema"
import type { Item } from "@/server/db/schema"
import type { Viewer } from "@/server/inbox/analyze"
import { analyze } from "@/server/inbox/analyze"
import { parseSubjectKey, toItem } from "@/server/inbox/notifications"
import type { RawNotification } from "@/server/inbox/notifications"
import { computePriority } from "@/server/inbox/priority"
import { detectAttention, recordAttention } from "@/server/inbox/attention"
import type { AttentionDraft } from "@/server/inbox/attention"
import { fetchStates, fetchSubjects } from "@/server/github/subjects"
import type { SubjectRef } from "@/server/github/subjects"

const INITIAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000
const MAX_NOTIFICATION_PAGES = 10
const REFRESH_ACTIVE_MS = 5 * 60 * 1000
const SEARCH_INTERVAL_MS = 5 * 60 * 1000
export const ENRICH_LIMIT = 100

type SyncState = {
  notificationsLastModified?: string
  notificationsSince?: string
  lastSearchAt?: string
}

async function readState(db: Database): Promise<SyncState> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, "sync"))
  ).at(0)
  return row?.value ?? {}
}

async function writeState(db: Database, state: SyncState) {
  await db
    .insert(settings)
    .values({ key: "sync", value: state })
    .onConflictDoUpdate({ target: settings.key, set: { value: state } })
}

async function ensureRepos(db: Database, fullNames: string[]) {
  if (fullNames.length === 0) return
  await db
    .insert(repos)
    .values([...new Set(fullNames)].map((fullName) => ({ fullName })))
    .onConflictDoNothing()
}

async function upsertNotifications(
  db: Database,
  notifications: RawNotification[]
) {
  if (notifications.length === 0) return
  await ensureRepos(
    db,
    notifications.map((n) => n.repository.full_name)
  )
  for (const notification of notifications) {
    const item = toItem(notification)
    await db
      .insert(items)
      .values(item)
      .onConflictDoUpdate({
        target: items.key,
        set: {
          title: item.title,
          subjectType: item.subjectType,
          threadId: item.threadId,
          reason: item.reason,
          unread: item.unread,
          updatedAt: item.updatedAt,
          // New activity on a subject marked done brings it back, like GitHub does.
          doneAt: sql`case when ${items.doneAt} < ${item.updatedAt} then null else ${items.doneAt} end`,
          autoDoneReason: sql`case when ${items.doneAt} < ${item.updatedAt} then null else ${items.autoDoneReason} end`,
        },
      })
  }
}

/**
 * Polls the notifications endpoint with If-Modified-Since: unchanged responses
 * are 304 and do not count against the rate limit.
 */
export async function pollNotifications(
  db: Database,
  octokit: Octokit
): Promise<{ changed: number; pollInterval: number }> {
  const state = await readState(db)
  const startedAt = new Date()
  const since =
    state.notificationsSince ??
    new Date(startedAt.getTime() - INITIAL_LOOKBACK_MS).toISOString()

  const collected: RawNotification[] = []
  let pollInterval = 60
  let lastModified = state.notificationsLastModified

  for (let page = 1; page <= MAX_NOTIFICATION_PAGES; page++) {
    try {
      const response = await octokit.request("GET /notifications", {
        all: true,
        since,
        per_page: 50,
        page,
        headers:
          page === 1 && state.notificationsLastModified
            ? { "if-modified-since": state.notificationsLastModified }
            : {},
      })
      if (page === 1) {
        pollInterval = Number(response.headers["x-poll-interval"] ?? 60)
        lastModified = response.headers["last-modified"] ?? lastModified
      }
      collected.push(...(response.data as RawNotification[]))
      if (response.data.length < 50) break
    } catch (error) {
      if ((error as { status?: number }).status === 304) break
      throw error
    }
  }

  await upsertNotifications(db, collected)
  await writeState(db, {
    ...state,
    notificationsLastModified: lastModified,
    // Small overlap so that notifications updated during the poll are not missed.
    notificationsSince: new Date(startedAt.getTime() - 60_000).toISOString(),
  })
  return { changed: collected.length, pollInterval }
}

/** Review requests whose notification is missing (older, or already read and cleared). */
export async function searchReviewRequests(
  db: Database,
  octokit: Octokit,
  force = false
) {
  const state = await readState(db)
  const last = state.lastSearchAt ? new Date(state.lastSearchAt).getTime() : 0
  if (!force && Date.now() - last < SEARCH_INTERVAL_MS) return

  const results = await octokit.paginate(
    octokit.rest.search.issuesAndPullRequests,
    {
      q: "is:open is:pr review-requested:@me archived:false",
      per_page: 100,
    }
  )
  const found = results.map((result) => {
    const [owner, repo] = result.repository_url.split("/").slice(-2)
    return {
      key: `${owner}/${repo}#${result.number}`,
      repoFullName: `${owner}/${repo}`,
      number: result.number,
      kind: "PullRequest" as const,
      title: result.title,
      htmlUrl: result.html_url,
      reason: "review_requested",
      unread: false,
      updatedAt: new Date(result.updated_at),
    }
  })
  await ensureRepos(
    db,
    found.map((item) => item.repoFullName)
  )
  if (found.length > 0)
    await db.insert(items).values(found).onConflictDoNothing()
  await writeState(db, {
    ...(await readState(db)),
    lastSearchAt: new Date().toISOString(),
  })
}

async function itemsToEnrich(db: Database): Promise<Item[]> {
  const stale = new Date(Date.now() - REFRESH_ACTIVE_MS)
  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(repos, eq(repos.fullName, items.repoFullName))
    .where(
      and(
        eq(repos.tracked, true),
        isNull(items.doneAt),
        inArray(items.kind, ["PullRequest", "Issue"]),
        or(
          isNull(items.enrichedAt),
          lt(items.enrichedAt, items.updatedAt),
          and(
            inArray(items.view, ["review", "awaiting", "mine"]),
            lt(items.enrichedAt, stale)
          )
        )
      )
    )
    // Subjects that directly involve the viewer are enriched first on the initial sync.
    .orderBy(
      sql`case when ${items.reason} in ('review_requested', 'mention', 'team_mention', 'author', 'assign') then 0 else 1 end`,
      sql`${items.updatedAt} desc`
    )
    .limit(ENRICH_LIMIT)
  return rows.map((row) => row.item)
}

export async function enrichItems(
  db: Database,
  octokit: Octokit,
  viewer: Viewer,
  candidates?: Item[],
  options: { notify?: boolean } = {}
): Promise<number> {
  const pending = candidates ?? (await itemsToEnrich(db))
  const attention: AttentionDraft[] = []
  const refs: SubjectRef[] = pending.flatMap((item) => {
    const parsed = parseSubjectKey(item.key)
    return parsed && (item.kind === "PullRequest" || item.kind === "Issue")
      ? [{ key: item.key, kind: item.kind, ...parsed }]
      : []
  })
  if (refs.length === 0) return 0

  const now = new Date()
  const states = await fetchStates(octokit, refs)
  const openRefs = refs.filter((ref) => states.get(ref.key) === "OPEN")
  const subjects = await fetchSubjects(octokit, openRefs)
  const model = getDecisionModel()

  await Promise.all(
    pending.map(async (item) => {
      const details = subjects.get(item.key)
      if (!details) {
        // Closed, merged or inaccessible: nothing to act on.
        await db
          .update(items)
          .set({
            state: states.get(item.key) ?? item.state,
            view: "other",
            awaitingMe: false,
            priority: 0,
            priorityReasons: [],
            needsCheck: false,
            enrichedAt: now,
          })
          .where(eq(items.key, item.key))
        return
      }
      const analysis = analyze(details, viewer)

      let ai = {
        aiUrgency: item.aiUrgency,
        aiConfidence: item.aiConfidence,
        aiQuestionProbability: item.aiQuestionProbability,
        aiHash: item.aiHash,
      }
      const isActive = analysis.view !== "other" && details.state === "OPEN"
      if (model && isActive) {
        const input = {
          details,
          awaiting: analysis.awaiting,
          viewerLogin: viewer.login,
        }
        const hash = triageHash(input)
        if (hash !== item.aiHash) {
          try {
            const result = await triage(model, input)
            ai = {
              aiUrgency: result.urgency,
              aiConfidence: result.confidence,
              aiQuestionProbability: result.questionProbability,
              aiHash: hash,
            }
          } catch (error) {
            console.error(`[triage] ${item.key}`, error)
          }
        }
      }

      const enriched = {
        title: details.title,
        htmlUrl: details.url,
        view: analysis.view,
        state: details.state,
        isDraft: details.isDraft,
        author: details.author,
        labels: details.labels,
        additions: details.additions,
        deletions: details.deletions,
        changedFiles: details.changedFiles,
        headOid: details.headOid,
        reviewedOid: analysis.lastReview?.oid ?? null,
        reviewedAt: analysis.lastReview?.at ?? null,
        reviewedState: analysis.lastReview?.state ?? null,
        ciState: details.ciState,
        reviewDecision: details.reviewDecision,
        reviewRequest: analysis.reviewRequest,
        approvals: details.approvals,
        pendingReviewers: details.reviewRequests.length,
        requestedAt: analysis.requestedAt,
        awaitingMe: analysis.awaiting !== null,
        awaitingUrl: analysis.awaiting?.url ?? null,
        awaitingExcerpt: analysis.awaiting?.excerpt ?? null,
        awaitingFrom: analysis.awaiting?.from ?? null,
        awaitingSince: analysis.awaiting?.since ?? null,
        ...ai,
        enrichedAt: now,
      }
      const priority = computePriority(
        { ...item, ...enriched, waitingSince: waitingSince(enriched) },
        now
      )
      await db
        .update(items)
        .set({
          ...enriched,
          priority: priority.priority,
          priorityReasons: priority.reasons,
          needsCheck: priority.needsCheck,
        })
        .where(eq(items.key, item.key))
      if (options.notify) {
        const draft = detectAttention(item, enriched, now)
        if (draft) attention.push(draft)
      }
    })
  )
  await recordAttention(db, attention)
  return pending.length
}

function waitingSince(
  item: Pick<Item, "requestedAt" | "awaitingSince">
): Date | null {
  return item.awaitingSince ?? item.requestedAt
}

/** Ages move every day, so priorities are recomputed locally without calling GitHub. */
export async function rescoreAll(db: Database) {
  const active = await db
    .select()
    .from(items)
    .where(
      and(
        isNull(items.doneAt),
        inArray(items.view, ["review", "awaiting", "mine"])
      )
    )
  const now = new Date()
  for (const item of active) {
    const priority = computePriority(
      { ...item, waitingSince: waitingSince(item) },
      now
    )
    const changed =
      priority.priority !== item.priority ||
      priority.needsCheck !== item.needsCheck ||
      JSON.stringify(priority.reasons) !== JSON.stringify(item.priorityReasons)
    if (changed) {
      await db
        .update(items)
        .set({
          priority: priority.priority,
          priorityReasons: priority.reasons,
          needsCheck: priority.needsCheck,
        })
        .where(eq(items.key, item.key))
    }
  }
}
