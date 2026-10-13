import { describe, expect, it } from "vitest"
import {
  groupSimilar,
  isReleaseTitle,
  shortLabel,
  toEntries,
  weekStart,
  weekSummaryText,
} from "./week"
import { messagesFor } from "@/lib/i18n/messages"

describe("weekStart", () => {
  it("goes back to Monday midnight, also from a Sunday", () => {
    expect(weekStart(new Date("2026-10-13T15:00:00")).toString()).toBe(
      new Date("2026-10-12T00:00:00").toString()
    )
    expect(weekStart(new Date("2026-10-18T09:00:00")).toString()).toBe(
      new Date("2026-10-12T00:00:00").toString()
    )
  })
})

describe("shortLabel", () => {
  it("drops conventional-commit and bracket prefixes", () => {
    expect(shortLabel("fix(shared): log business errors")).toBe(
      "Log business errors"
    )
    expect(shortLabel("feat!: drop the v1 API")).toBe("Drop the v1 API")
    expect(shortLabel("[US] [TECH] – Peak season blocking")).toBe(
      "Peak season blocking"
    )
    expect(shortLabel("Plain title")).toBe("Plain title")
  })
})

describe("isReleaseTitle", () => {
  it("spots releases, bumps and branch promotions", () => {
    expect(isReleaseTitle("chore(development): release 4.2.0")).toBe(true)
    expect(isReleaseTitle("chore!: bump version")).toBe(true)
    expect(isReleaseTitle("Development")).toBe(true)
    expect(isReleaseTitle("fix(shared): release the lock")).toBe(false)
  })
})

describe("toEntries and weekSummaryText", () => {
  it("keeps real work in time order and writes short bullets", () => {
    const shipped = toEntries(
      [
        {
          number: 2,
          title: "feat(api): add export",
          url: "u2",
          repository: { nameWithOwner: "acme/app" },
          mergedAt: "2026-10-13T10:00:00Z",
        },
        {
          number: 1,
          title: "fix(web): restore login",
          url: "u1",
          repository: { nameWithOwner: "acme/app" },
          mergedAt: "2026-10-12T10:00:00Z",
        },
        {
          number: 3,
          title: "chore(main): release 1.0.0",
          url: "u3",
          repository: { nameWithOwner: "acme/app" },
          mergedAt: "2026-10-12T11:00:00Z",
        },
      ],
      (node) => node.mergedAt
    )
    expect(shipped.map((entry) => entry.number)).toEqual([1, 2])
    const summary = {
      since: "2026-10-12T00:00:00Z",
      shipped,
      started: [],
      closed: [],
      reviewed: [shipped[0]],
    }
    expect(weekSummaryText(summary, messagesFor("fr"))).toBe(
      "Livré :\n• Restore login (#1)\n• Add export (#2)\n\nReviewé :\n• Restore login"
    )
    expect(weekSummaryText(summary, messagesFor("en"))).toBe(
      "Shipped:\n• Restore login (#1)\n• Add export (#2)\n\nReviewed:\n• Restore login"
    )
  })
})

describe("groupSimilar", () => {
  it("folds generated tickets into one counted line", () => {
    const entry = (number: number, label: string) => ({
      key: `acme/infra#${number}`,
      label,
      url: `u${number}`,
      repo: "acme/infra",
      number,
      at: `2026-10-12T0${number}:00:00Z`,
      author: "github-actions",
      count: 1,
    })
    const grouped = groupSimilar([
      entry(1, "Apply 5b33f43 to GCP?"),
      entry(2, "Apply 4d61021 to GCP?"),
      entry(3, "Fix the login page"),
    ])
    expect(grouped.map((e) => [e.label, e.count])).toEqual([
      ["Apply … to GCP?", 2],
      ["Fix the login page", 1],
    ])
  })
})
