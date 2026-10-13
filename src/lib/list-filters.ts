import type { Language } from "@/lib/i18n/core"

/** One filter of a list: the values an item has for it, and the labels of those values. */
export type FilterDef<T> = {
  id: string
  label: string
  /** The item's values: one for a state, several for labels. */
  valuesOf: (item: T) => string[]
  /** Values in the menu's order; when absent, the values the items have, sorted. */
  options?: { value: string; label: string }[]
}

export type FilterSelection = Record<string, string[]>

/** An item is kept when, for every filter with a selection, it has one of the chosen values. */
export function applyFilters<T>(
  items: T[],
  defs: FilterDef<T>[],
  selection: FilterSelection
): T[] {
  const active = defs.filter((def) => (selection[def.id] ?? []).length > 0)
  if (active.length === 0) return items
  return items.filter((item) =>
    active.every((def) => {
      const chosen = new Set(selection[def.id])
      return def.valuesOf(item).some((value) => chosen.has(value))
    })
  )
}

/** The menu's options with how many items each one keeps, the empty ones left out. */
export function filterOptions<T>(
  items: T[],
  def: FilterDef<T>,
  language: Language
): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const item of items)
    for (const value of new Set(def.valuesOf(item)))
      counts.set(value, (counts.get(value) ?? 0) + 1)
  const options =
    def.options ??
    [...counts.keys()]
      .sort((a, b) => a.localeCompare(b, language))
      .map((value) => ({ value, label: value }))
  return options
    .map((option) => ({ ...option, count: counts.get(option.value) ?? 0 }))
    .filter((option) => option.count > 0)
}

/** The selection without a value, or with it when it was not there. */
export function toggleValue(
  selection: FilterSelection,
  id: string,
  value: string
): FilterSelection {
  const current = selection[id] ?? []
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value]
  const { [id]: _, ...rest } = selection
  return next.length > 0 ? { ...rest, [id]: next } : rest
}

/** Newest or oldest first, on a date that may be missing (those go last). */
export function byDate<T>(
  dateOf: (item: T) => Date | string | null,
  order: "desc" | "asc"
) {
  return (a: T, b: T) => {
    const time = (item: T) => {
      const date = dateOf(item)
      return date === null ? null : new Date(date).getTime()
    }
    const [x, y] = [time(a), time(b)]
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1
    return order === "desc" ? y - x : x - y
  }
}
