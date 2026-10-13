import type { Messages } from "@/lib/i18n/messages"

/** The orders every list shares; their names live in `t.inbox.sorts`, so one order reads the same everywhere. */
export type SortKind = keyof Messages["inbox"]["sorts"]

export type SortOption<TValue extends string> = {
  value: TValue
  kind: SortKind
}

/** A list's sort menu: each of its values, with the order it applies. */
export function sortOptions<TValue extends string>(
  kinds: Record<TValue, SortKind>
): SortOption<TValue>[] {
  return (Object.entries(kinds) as [TValue, SortKind][]).map(
    ([value, kind]) => ({ value, kind })
  )
}
