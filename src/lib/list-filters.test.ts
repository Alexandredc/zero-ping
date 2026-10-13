import { describe, expect, it } from "vitest"
import {
  applyFilters,
  byDate,
  filterOptions,
  toggleValue,
} from "./list-filters"
import type { FilterDef } from "./list-filters"

type Pull = { author: string; labels: string[]; at: string | null }

const pulls: Pull[] = [
  { author: "ana", labels: ["bug"], at: "2026-10-12" },
  { author: "bob", labels: ["bug", "infra"], at: null },
  { author: "ana", labels: [], at: "2026-10-13" },
]

const defs: FilterDef<Pull>[] = [
  { id: "author", label: "Auteur", valuesOf: (p) => [p.author] },
  { id: "label", label: "Label", valuesOf: (p) => p.labels },
]

describe("applyFilters", () => {
  it("keeps any chosen value of a filter, and every filter at once", () => {
    expect(applyFilters(pulls, defs, {})).toBe(pulls)
    expect(applyFilters(pulls, defs, { label: ["bug", "infra"] })).toEqual(
      pulls.slice(0, 2)
    )
    expect(
      applyFilters(pulls, defs, { author: ["ana"], label: ["bug"] })
    ).toEqual([pulls[0]])
  })
})

describe("filterOptions", () => {
  it("counts the items of each value and drops the empty ones", () => {
    expect(filterOptions(pulls, defs[1])).toEqual([
      { value: "bug", label: "bug", count: 2 },
      { value: "infra", label: "infra", count: 1 },
    ])
    expect(
      filterOptions(pulls, {
        ...defs[0],
        options: [
          { value: "zoe", label: "Zoé" },
          { value: "bob", label: "Bob" },
        ],
      })
    ).toEqual([{ value: "bob", label: "Bob", count: 1 }])
  })
})

describe("toggleValue", () => {
  it("adds a value, then removes the filter with its last value", () => {
    const once = toggleValue({}, "author", "ana")
    expect(once).toEqual({ author: ["ana"] })
    expect(toggleValue(once, "author", "ana")).toEqual({})
  })
})

describe("byDate", () => {
  it("sorts on the date and leaves undated items last", () => {
    const keys = (order: "asc" | "desc") =>
      [...pulls].sort(byDate((p) => p.at, order)).map((p) => p.at)
    expect(keys("desc")).toEqual(["2026-10-13", "2026-10-12", null])
    expect(keys("asc")).toEqual(["2026-10-12", "2026-10-13", null])
  })
})
