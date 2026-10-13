import { and, desc, eq, gt, inArray, lt } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { attentionEvents, settings } from "@/server/db/schema"
import type { AttentionKind, Item } from "@/server/db/schema"
import type { Messages } from "@/lib/i18n/messages"

export type AttentionDraft = {
  itemKey: string
  kind: AttentionKind
  title: string
  body: string
}

type Snapshot = Pick<
  Item,
  | "view"
  | "awaitingUrl"
  | "awaitingFrom"
  | "awaitingExcerpt"
  | "reviewRequest"
  | "reviewDecision"
  | "ciState"
  | "state"
>

const KEEP_EVENTS = 200
const BASELINE_KEY = "attention-baseline"

function reference(item: Pick<Item, "repoFullName" | "number" | "title">) {
  const name = item.repoFullName.split("/")[1]
  return `${name}${item.number === null ? "" : `#${item.number}`} · ${item.title}`
}

/**
 * Compares an item before and after enrichment and describes what newly needs
 * the viewer, if anything. Only transitions count, so a sync that changes
 * nothing never notifies twice. The text is written now, in `t`'s language,
 * and stored with the event.
 */
export function detectAttention(
  before: Item,
  after: Snapshot,
  t: Messages,
  now: Date = new Date()
): AttentionDraft | null {
  const m = t.server.attention
  if (after.state !== "OPEN") return null
  if (before.doneAt || (before.snoozedUntil && before.snoozedUntil > now))
    return null
  const base = { itemKey: before.key }
  const ref = reference(before)

  if (after.view === "review" && before.view !== "review") {
    return {
      ...base,
      kind: "review",
      title:
        after.reviewRequest === "team"
          ? m.reviewTeam
          : after.reviewRequest === "direct"
            ? m.reviewDirect
            : m.fixesPushed,
      body: ref,
    }
  }
  if (after.awaitingUrl && after.awaitingUrl !== before.awaitingUrl) {
    return {
      ...base,
      kind: "awaiting",
      title: m.awaiting(after.awaitingFrom ?? m.someone),
      body: `${ref}\n${after.awaitingExcerpt ?? ""}`.trim(),
    }
  }
  if (after.view === "mine") {
    if (
      after.reviewDecision === "CHANGES_REQUESTED" &&
      before.reviewDecision !== "CHANGES_REQUESTED"
    ) {
      return {
        ...base,
        kind: "changes",
        title: m.changesRequested,
        body: ref,
      }
    }
    const failing = (state: string | null) =>
      state === "FAILURE" || state === "ERROR"
    if (failing(after.ciState) && !failing(before.ciState)) {
      return { ...base, kind: "ci", title: m.ciFailing, body: ref }
    }
  }
  return null
}

/**
 * Notifications start after the first complete sync: everything is new on an
 * empty database, and nobody wants 30 notifications at once.
 */
export async function attentionReady(db: Database): Promise<boolean> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, BASELINE_KEY))
  ).at(0)
  return row !== undefined
}

export async function markAttentionReady(db: Database) {
  await db
    .insert(settings)
    .values({ key: BASELINE_KEY, value: { at: new Date().toISOString() } })
    .onConflictDoNothing()
}

export async function recordAttention(db: Database, drafts: AttentionDraft[]) {
  if (drafts.length === 0) return
  await db.insert(attentionEvents).values(drafts)
  const kept = await db
    .select({ id: attentionEvents.id })
    .from(attentionEvents)
    .orderBy(desc(attentionEvents.id))
    .limit(1)
    .offset(KEEP_EVENTS)
  const oldest = kept.at(0)
  if (oldest)
    await db.delete(attentionEvents).where(lt(attentionEvents.id, oldest.id))
}

/** Latest event id, and the events after `afterId` of the wanted kinds. */
export async function readAttention(
  db: Database,
  afterId: number | null,
  kinds: AttentionKind[]
) {
  const latest = (
    await db
      .select({ id: attentionEvents.id })
      .from(attentionEvents)
      .orderBy(desc(attentionEvents.id))
      .limit(1)
  ).at(0)
  const latestId = latest?.id ?? 0
  if (afterId === null || kinds.length === 0) return { latestId, events: [] }
  const events = await db
    .select()
    .from(attentionEvents)
    .where(
      and(gt(attentionEvents.id, afterId), inArray(attentionEvents.kind, kinds))
    )
    .orderBy(attentionEvents.id)
    .limit(20)
  return { latestId, events }
}
