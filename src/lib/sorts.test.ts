import { describe, expect, it } from "vitest"
import { sortOptions } from "./sorts"

describe("sortOptions", () => {
  it("names each value after its order, in the list's own order", () => {
    expect(sortOptions({ jev: "priority", recent: "recent" })).toEqual([
      { value: "jev", label: "Priorité (Jev)" },
      { value: "recent", label: "Activité récente" },
    ])
  })
})
