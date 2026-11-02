import type { Messages } from "@/lib/i18n/messages"

/**
 * What can be under way on an item, from the user's clicks or the server's own
 * background work. The list shows it on the item's row.
 */
export const ITEM_ACTIVITIES = [
  // Started from the UI.
  "done",
  "undone",
  "snooze",
  "ignoreTeam",
  "reply",
  "review",
  "merge",
  "rerunChecks",
  "takeReview",
  "reviewers",
  "projectField",
  "slackReply",
  "reviewNotice",
  "question",
  // Started from the UI or by the server on its own.
  "summary",
  "insights",
  "slackSearch",
  // The server's own work during a sync.
  "triage",
  "readiness",
] as const

export type ItemActivity = (typeof ITEM_ACTIVITIES)[number]

/** Item key → what runs on it, as the server reports it. */
export type ActivitySnapshot = Record<string, ItemActivity[]>

/**
 * Tags a mutation with the activity it shows on its items. The activity and
 * the keys can depend on the mutation's variables (« Remettre » vs
 * « Traités », a selection of items).
 */
export type ActivityMeta<TVariables = never> = {
  activity: ItemActivity | ((variables: TVariables) => ItemActivity)
  itemKeys: readonly string[] | ((variables: TVariables) => readonly string[])
}

export function activityMeta<TVariables>(
  activity: ActivityMeta<TVariables>["activity"],
  itemKeys: ActivityMeta<TVariables>["itemKeys"]
): Record<string, unknown> {
  return { activity, itemKeys }
}

/** Reads a pending mutation's tag, or null for a mutation that is not about items. */
export function readActivityMeta(
  meta: Record<string, unknown> | undefined,
  variables: unknown
): { activity: ItemActivity; itemKeys: readonly string[] } | null {
  if (!meta?.activity || !meta.itemKeys) return null
  const resolve = <T>(value: unknown): T =>
    typeof value === "function"
      ? (value as (v: unknown) => T)(variables)
      : (value as T)
  return {
    activity: resolve<ItemActivity>(meta.activity),
    itemKeys: resolve<readonly string[]>(meta.itemKeys),
  }
}

/**
 * Joins the server's activity and the pending mutations of this tab, once per
 * item and in a stable order: a summary asked from here is also the server's.
 */
export function mergeActivity(
  server: ActivitySnapshot | undefined,
  client: readonly { activity: ItemActivity; itemKeys: readonly string[] }[]
): Map<string, ItemActivity[]> {
  const byKey = new Map<string, Set<ItemActivity>>()
  const add = (key: string, activity: ItemActivity) => {
    const set = byKey.get(key) ?? new Set()
    set.add(activity)
    byKey.set(key, set)
  }
  for (const [key, activities] of Object.entries(server ?? {}))
    for (const activity of activities) add(key, activity)
  for (const { activity, itemKeys } of client)
    for (const key of itemKeys) add(key, activity)
  return new Map(
    [...byKey].map(([key, set]) => [
      key,
      ITEM_ACTIVITIES.filter((activity) => set.has(activity)),
    ])
  )
}

/** The row's short label (the first activity, then a count) and its full hint. */
export function describeActivity(
  activities: readonly ItemActivity[],
  t: Messages
): { label: string; hint: string } {
  const labels = activities.map((activity) => t.inbox.strip.activity[activity])
  const first = labels[0] ?? ""
  return {
    label: `${first.charAt(0).toUpperCase()}${first.slice(1)}…${labels.length > 1 ? ` +${labels.length - 1}` : ""}`,
    hint: t.inbox.strip.activityHint(labels.join(", ")),
  }
}
