import { and, eq, isNull, lte, or } from "drizzle-orm"
import type { Octokit } from "octokit"
import type { Database } from "@/server/db/client"
import { items, repos } from "@/server/db/schema"
import type { Item } from "@/server/db/schema"
import type { Preferences } from "@/server/preferences"
import type { Messages } from "@/lib/i18n/messages"

export type AutoDoneRules = Pick<
  Preferences,
  | "autoDoneClosed"
  | "autoDoneBots"
  | "autoDoneCi"
  | "autoDoneReleases"
  | "autoDoneAuthors"
>

const BOT_LOGINS = new Set([
  "dependabot",
  "renovate",
  "renovate-bot",
  "github-actions",
  "snyk-bot",
  "mergify",
])

/** GraphQL returns bot logins without the REST `[bot]` suffix. */
export function isBot(login: string | null): boolean {
  if (!login) return false
  const name = login.toLowerCase()
  return name.endsWith("[bot]") || BOT_LOGINS.has(name)
}

/**
 * Returns the label of the first rule that files the item away, or null.
 * Items that still wait for the viewer are never filed automatically.
 */
export function matchAutoRule(
  item: Pick<
    Item,
    "view" | "awaitingMe" | "state" | "author" | "reason" | "subjectType"
  >,
  rules: AutoDoneRules,
  t: Messages
): string | null {
  const m = t.server.autoDone
  if (item.view !== "other" || item.awaitingMe) return null
  if (
    rules.autoDoneClosed &&
    (item.state === "MERGED" || item.state === "CLOSED")
  )
    return item.state === "MERGED" ? m.merged : m.closed
  if (rules.autoDoneCi && item.reason === "ci_activity") return m.ci
  if (rules.autoDoneReleases && item.subjectType === "Release") return m.release
  if (rules.autoDoneBots && isBot(item.author)) return m.bot(item.author ?? "")
  const author = item.author?.toLowerCase()
  if (author && rules.autoDoneAuthors.includes(author))
    return m.author(item.author ?? author)
  return null
}

const CONCURRENCY = 8

/** Files away what matches the rules, here and in the GitHub notifications. */
export async function applyAutoRules(
  db: Database,
  octokit: Octokit,
  rules: AutoDoneRules,
  t: Messages,
  now: Date = new Date()
): Promise<number> {
  const candidates = await db
    .select({ item: items })
    .from(items)
    .innerJoin(repos, eq(repos.fullName, items.repoFullName))
    .where(
      and(
        eq(repos.tracked, true),
        isNull(items.doneAt),
        eq(items.view, "other"),
        // A snoozed item was set aside on purpose: it comes back first.
        or(isNull(items.snoozedUntil), lte(items.snoozedUntil, now))
      )
    )
  const matched = candidates.flatMap(({ item }) => {
    const reason = matchAutoRule(item, rules, t)
    return reason ? [{ item, reason }] : []
  })
  for (let start = 0; start < matched.length; start += CONCURRENCY) {
    await Promise.all(
      matched
        .slice(start, start + CONCURRENCY)
        .map(async ({ item, reason }) => {
          await db
            .update(items)
            .set({ doneAt: now, autoDoneReason: reason })
            .where(eq(items.key, item.key))
          if (item.threadId) {
            await octokit.rest.activity
              .markThreadAsDone({ thread_id: Number(item.threadId) })
              .catch((error: unknown) =>
                console.error(`[auto-done] ${item.key}`, error)
              )
          }
        })
    )
  }
  return matched.length
}
