/** The sort names every list uses, so that one order reads the same everywhere. */
export const SORT_LABELS = {
  priority: "Priorité (Jev)",
  size: "Taille",
  recent: "Activité récente",
  oldest: "Sans activité depuis longtemps",
  waiting: "En attente depuis longtemps",
} as const

export type SortKind = keyof typeof SORT_LABELS

/** A list's sort menu: each of its values, named after the order it applies. */
export function sortOptions<TValue extends string>(
  kinds: Record<TValue, SortKind>
): { value: TValue; label: string }[] {
  return (Object.entries(kinds) as [TValue, SortKind][]).map(
    ([value, kind]) => ({ value, label: SORT_LABELS[kind] })
  )
}
