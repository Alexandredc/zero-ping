import { describe, expect, it } from "vitest"
import { pullFilters } from "./pull-list-options"
import { messagesFor } from "@/lib/i18n/messages"

const labelsOf = (language: "fr" | "en", id: string) =>
  pullFilters(messagesFor(language))
    .find((def) => def.id === id)
    ?.options?.map((option) => option.label)

describe("pullFilters", () => {
  it("names the filters and their options in the chosen language", () => {
    expect(pullFilters(messagesFor("fr")).map((def) => def.label)).toContain(
      "Urgence Jev"
    )
    expect(pullFilters(messagesFor("en")).map((def) => def.label)).toContain(
      "Jev urgency"
    )
    expect(labelsOf("fr", "jev")).toEqual([
      "Bloquante",
      "Importante",
      "Normale",
      "Peut attendre",
    ])
    expect(labelsOf("en", "jev")).toEqual([
      "Blocking",
      "Important",
      "Normal",
      "Can wait",
    ])
    expect(labelsOf("fr", "size")?.[0]).toBe("Taille XS")
    expect(labelsOf("en", "size")?.[0]).toBe("Size XS")
  })

  it("keeps the same filters whatever the language", () => {
    const ids = (language: "fr" | "en") =>
      pullFilters(messagesFor(language)).map((def) => def.id)
    expect(ids("en")).toEqual(ids("fr"))
  })
})
