import { and, desc, eq, inArray, isNull, lt, notInArray, or } from "drizzle-orm"
import { getAgentConfig, runAgent } from "@/server/agents/runner"
import type { AgentConfig, AgentTask } from "@/server/agents/runner"
import type { Database } from "@/server/db/client"
import { items, slackLookups } from "@/server/db/schema"
import type { Item, SlackLookup } from "@/server/db/schema"
import { getPreferences, resolveExclusions } from "@/server/preferences"
import {
  DISCUSSIONS_JSON_SCHEMA,
  buildSlackPrompt,
  parseDiscussions,
  slackTools,
} from "@/server/slack/discussions"

/** Results stay valid this long before a background refresh. */
export const LOOKUP_TTL_MS = 6 * 60 * 60 * 1000
/** A lookup still pending after this long was interrupted (restart, crash). */
const STALE_PENDING_MS = 10 * 60 * 1000
const AUTO_LOOKUPS_PER_SYNC = 3

export type AgentRunner = (
  task: AgentTask,
  config: AgentConfig
) => Promise<unknown>

export function slackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SLACK_SEARCH !== "off"
}

/** Runs one lookup at a time: each one is a full agent session. */
let queue: Promise<unknown> = Promise.resolve()
const queued = new Set<string>()

function isFresh(lookup: SlackLookup | undefined, now: number): boolean {
  if (!lookup) return false
  if (lookup.status === "pending")
    return now - lookup.startedAt.getTime() < STALE_PENDING_MS
  return now - (lookup.finishedAt ?? lookup.startedAt).getTime() < LOOKUP_TTL_MS
}

/** Excluded names and channel ids, resolved over every thread found so far. */
export async function slackExclusions(
  db: Database,
  excluded: string[]
): Promise<Set<string>> {
  if (excluded.length === 0) return new Set()
  const rows = await db
    .select({ discussions: slackLookups.discussions })
    .from(slackLookups)
  return resolveExclusions(
    excluded,
    rows.flatMap((row) => row.discussions)
  )
}

/** Agent settings from the settings page, over the `.env` defaults. */
export async function resolveAgentConfig(db: Database) {
  return getAgentConfig(process.env, await getPreferences(db))
}

async function runLookup(db: Database, item: Item, runner: AgentRunner) {
  const preferences = await getPreferences(db)
  const config = getAgentConfig(process.env, preferences)
  const tools = slackTools(config.kind)
  try {
    const answer = await runner(
      {
        prompt: buildSlackPrompt(
          {
            repoFullName: item.repoFullName,
            number: item.number ?? 0,
            title: item.title,
            htmlUrl: item.htmlUrl,
            kind: item.kind === "Issue" ? "Issue" : "PullRequest",
          },
          tools,
          [...(await slackExclusions(db, preferences.slackExcludedChannels))]
        ),
        schema: DISCUSSIONS_JSON_SCHEMA,
        allowedTools: tools,
      },
      config
    )
    await db
      .update(slackLookups)
      .set({
        status: "done",
        discussions: parseDiscussions(answer),
        error: null,
        finishedAt: new Date(),
      })
      .where(eq(slackLookups.itemKey, item.key))
  } catch (error) {
    console.error(`[slack] ${item.key}`, error)
    await db
      .update(slackLookups)
      .set({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      })
      .where(eq(slackLookups.itemKey, item.key))
  }
}

/**
 * Queues a Slack search for the item unless a fresh result exists. Returns the
 * current row, `pending` while the agent works.
 */
export async function requestLookup(
  db: Database,
  item: Item,
  options: { force?: boolean; runner?: AgentRunner } = {}
): Promise<SlackLookup | undefined> {
  const now = Date.now()
  const current = (
    await db
      .select()
      .from(slackLookups)
      .where(eq(slackLookups.itemKey, item.key))
  ).at(0)
  if (queued.has(item.key)) return current
  if (!options.force && isFresh(current, now)) return current
  if (
    (item.kind !== "PullRequest" && item.kind !== "Issue") ||
    item.number === null
  )
    return current

  const pending = {
    itemKey: item.key,
    status: "pending" as const,
    agent: (await resolveAgentConfig(db)).kind,
    startedAt: new Date(now),
    finishedAt: null,
    error: null,
  }
  const [row] = await db
    .insert(slackLookups)
    .values(pending)
    .onConflictDoUpdate({ target: slackLookups.itemKey, set: pending })
    .returning()

  queued.add(item.key)
  const runner = options.runner ?? runAgent
  queue = queue
    .then(() => runLookup(db, item, runner))
    .finally(() => queued.delete(item.key))
  return row
}

/** Background prefetch for the PRs that need an action, a few per sync. */
export async function prefetchLookups(db: Database) {
  if (!slackEnabled() || queued.size > 0) return
  if (!(await getPreferences(db)).slackAutoSearch) return
  const stale = new Date(Date.now() - LOOKUP_TTL_MS)
  const rows = await db
    .select({ item: items })
    .from(items)
    .leftJoin(slackLookups, eq(slackLookups.itemKey, items.key))
    .where(
      and(
        isNull(items.doneAt),
        eq(items.kind, "PullRequest"),
        inArray(items.view, ["review", "awaiting", "mine"]),
        or(
          isNull(slackLookups.itemKey),
          and(
            notInArray(slackLookups.status, ["pending"]),
            lt(slackLookups.finishedAt, stale)
          )
        )
      )
    )
    .orderBy(desc(items.priority))
    .limit(AUTO_LOOKUPS_PER_SYNC)
  for (const { item } of rows) await requestLookup(db, item)
}

/** Waits for queued lookups; used by tests. */
export function drainLookups() {
  return queue
}

/** Shows a reply sent from the app right away, without a new Slack search. */
export async function appendReply(
  db: Database,
  itemKey: string,
  permalink: string,
  text: string,
  postedAt: Date = new Date()
) {
  const lookup = (
    await db
      .select()
      .from(slackLookups)
      .where(eq(slackLookups.itemKey, itemKey))
  ).at(0)
  if (!lookup) return
  const discussions = lookup.discussions.map((discussion) =>
    discussion.permalink === permalink
      ? {
          ...discussion,
          messages: [
            ...discussion.messages,
            { author: "Toi", text, postedAt: postedAt.toISOString() },
          ],
        }
      : discussion
  )
  await db
    .update(slackLookups)
    .set({ discussions })
    .where(eq(slackLookups.itemKey, itemKey))
}
