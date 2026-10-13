import { describe, expect, it } from "vitest"
import { sortOptions } from "./sorts"
import { messagesFor } from "@/lib/i18n/messages"

describe("sortOptions", () => {
  it("keeps each value with its order, in the list's own order", () => {
    expect(sortOptions({ jev: "priority", recent: "recent" })).toEqual([
      { value: "jev", kind: "priority" },
      { value: "recent", kind: "recent" },
    ])
  })
})

describe("sort names", () => {
  it("names every order in both languages", () => {
    expect(messagesFor("fr").inbox.sorts.priority).toBe("Priorité (Jev)")
    expect(messagesFor("en").inbox.sorts.priority).toBe("Priority (Jev)")
    expect(Object.keys(messagesFor("en").inbox.sorts)).toEqual(
      Object.keys(messagesFor("fr").inbox.sorts)
    )
  })
})
