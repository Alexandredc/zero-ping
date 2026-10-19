import { describe, expect, it } from "vitest"
import { DIRECT_REQUEST, pullFilters } from "./pull-list-options"
import { messagesFor } from "@/lib/i18n/messages"
import { filterOptions } from "@/lib/list-filters"
import type { InboxItem } from "@/server/inbox/actions"

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

  it("tells a request naming the viewer from one asked of a team", () => {
    const team = pullFilters(messagesFor("fr")).find((def) => def.id === "team")
    const request = (
      reviewRequest: InboxItem["reviewRequest"],
      reviewTeams: string[] = []
    ) => ({ reviewRequest, reviewTeams }) as InboxItem
    const items = [
      request("direct", ["acme/web"]),
      request("team", ["acme/web", "acme/api"]),
      request(null),
    ]
    expect(team?.valuesOf(items[0])).toEqual([DIRECT_REQUEST])
    expect(team?.valuesOf(items[1])).toEqual(["acme/web", "acme/api"])
    expect(team?.valuesOf(items[2])).toEqual([])
    expect(
      team && filterOptions(items, team, "fr").map((option) => option.label)
    ).toEqual(["Moi, nommément", "@acme/api", "@acme/web"])
  })
})
