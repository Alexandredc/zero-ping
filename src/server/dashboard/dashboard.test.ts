import { describe, expect, it } from "vitest"
import { viewTransitions } from "./activity"
import {
  dailyFlow,
  median,
  noisyRepos,
  reviewDelays,
  zeroPingStreak,
} from "./trends"
import { teamWeather, weatherFor } from "./weather"
import { formatMinutes, nextAction, summarizeWorkload } from "./workload"
import type { Item } from "@/server/db/schema"

const base = {
  view: "review",
  kind: "PullRequest",
  additions: 40,
  deletions: 10,
  headOid: "head",
  reviewedOid: null,
  reviewedState: null,
  reviewRequest: "direct",
  awaitingFrom: null,
  awaitingMe: false,
  ciState: "SUCCESS",
  reviewDecision: null,
} as const

describe("nextAction", () => {
  it("sizes a review by the PR's changed lines", () => {
    expect(nextAction(base)).toEqual({
      kind: "review",
      label: "Reviewer",
      minutes: 10,
    })
  })

  it("halves a re-review and names pushed fixes", () => {
    const fixes = nextAction({
      ...base,
      additions: 300,
      reviewRequest: null,
      reviewedOid: "old",
      reviewedState: "CHANGES_REQUESTED",
    })
    expect(fixes).toMatchObject({ kind: "fixes", minutes: 10 })
  })

  it("covers replies and the viewer's own PRs", () => {
    expect(
      nextAction({ ...base, view: "awaiting", awaitingFrom: "dev" })?.label
    ).toBe("Répondre à @dev")
    expect(
      nextAction({ ...base, view: "mine", ciState: "FAILURE" })?.kind
    ).toBe("ci")
    expect(
      nextAction({ ...base, view: "mine", reviewDecision: "APPROVED" })?.kind
    ).toBe("merge")
    expect(
      nextAction({
        ...base,
        view: "mine",
        awaitingMe: true,
        awaitingFrom: "dev",
      })?.kind
    ).toBe("reply")
    // Waiting on reviewers: nothing to do.
    expect(nextAction({ ...base, view: "mine" })).toBeNull()
  })
})

describe("summarizeWorkload", () => {
  it("adds the estimates per folder and keeps the order", () => {
    const items = [
      { ...base, key: "a" },
      { ...base, key: "b", view: "awaiting" },
      { ...base, key: "c", view: "mine" },
    ] as unknown as Item[]
    const workload = summarizeWorkload(items)
    expect(workload.byView).toEqual({ review: 10, awaiting: 5, mine: 0 })
    expect(workload.totalMinutes).toBe(15)
    expect(workload.actions.map((action) => action.item.key)).toEqual([
      "a",
      "b",
    ])
  })
})

describe("formatMinutes", () => {
  it("rounds to five minutes", () => {
    expect(formatMinutes(0)).toBe("0 min")
    expect(formatMinutes(43)).toBe("≈ 45 min")
    expect(formatMinutes(130)).toBe("≈ 2 h 10")
    expect(formatMinutes(120)).toBe("≈ 2 h")
  })
})

describe("viewTransitions", () => {
  const now = new Date("2026-10-12T12:00:00Z")
  it("logs work arriving, dated by the request", () => {
    const requested = new Date("2026-10-10T09:00:00Z")
    expect(viewTransitions("k", "other", "review", now, requested)).toEqual([
      { at: requested, kind: "entered", view: "review", itemKey: "k" },
    ])
  })

  it("logs work done when an item leaves a waiting folder", () => {
    expect(viewTransitions("k", "awaiting", "other", now)).toEqual([
      { at: now, kind: "left", view: "awaiting", itemKey: "k" },
    ])
    expect(viewTransitions("k", "mine", "other", now)).toEqual([])
    expect(viewTransitions("k", "review", "review", now)).toEqual([])
  })
})

describe("trends", () => {
  const now = new Date(2026, 9, 12, 15)

  it("counts arrivals and departures per day, empty days included", () => {
    const flow = dailyFlow(
      [
        { at: new Date(2026, 9, 12, 9), kind: "entered" },
        { at: new Date(2026, 9, 12, 10), kind: "left" },
        { at: new Date(2026, 9, 11, 10), kind: "left" },
        { at: new Date(2026, 8, 1), kind: "left" },
      ],
      now,
      3
    )
    expect(flow).toEqual([
      { date: "2026-10-10", entered: 0, left: 0 },
      { date: "2026-10-11", entered: 0, left: 1 },
      { date: "2026-10-12", entered: 1, left: 1 },
    ])
  })

  it("measures review delays and their median", () => {
    const delays = reviewDelays([
      {
        requestedAt: new Date("2026-10-01T09:00Z"),
        reviewedAt: new Date("2026-10-01T11:00Z"),
      },
      {
        requestedAt: new Date("2026-10-02T09:00Z"),
        reviewedAt: new Date("2026-10-01T09:00Z"),
      },
      { requestedAt: null, reviewedAt: new Date() },
    ])
    expect(delays).toEqual([2])
    expect(median([1, 9, 3])).toBe(3)
    expect(median([1, 3])).toBe(2)
    expect(median([])).toBeNull()
  })

  it("counts the zero-ping streak, today included once reached", () => {
    const days = [
      { date: "2026-10-09", minPings: 0 },
      { date: "2026-10-10", minPings: 0 },
      { date: "2026-10-11", minPings: 0 },
      { date: "2026-10-12", minPings: 4 },
    ]
    expect(zeroPingStreak(days, now)).toBe(3)
    expect(
      zeroPingStreak(
        [...days.slice(0, 3), { date: "2026-10-12", minPings: 0 }],
        now
      )
    ).toBe(4)
    expect(zeroPingStreak([{ date: "2026-10-09", minPings: 0 }], now)).toBe(0)
  })

  it("ranks the noisiest repositories", () => {
    expect(
      noisyRepos([
        { repo: "a", count: 1 },
        { repo: "b", count: 3 },
      ])
    ).toEqual([
      { repo: "b", count: 3, share: 0.75 },
      { repo: "a", count: 1, share: 0.25 },
    ])
  })
})

describe("teamWeather", () => {
  it("builds one row per person, stormiest first", () => {
    const rows = teamWeather(
      [
        {
          number: 1,
          author: "jdoe",
          isDraft: false,
          reviewers: ["lead", "team:leads"],
          problems: ["ci"],
        },
        {
          number: 2,
          author: "jdoe",
          isDraft: false,
          reviewers: ["chloe"],
          problems: ["conflict"],
        },
        {
          number: 3,
          author: "chloe",
          isDraft: false,
          reviewers: [],
          problems: [],
        },
        {
          number: 4,
          author: "chloe",
          isDraft: true,
          reviewers: ["jdoe"],
          problems: [],
        },
      ],
      { login: "Lead", reviewsDue: 7, openPulls: 2, blocked: 0 }
    )
    expect(rows.map((row) => [row.login, row.weather])).toEqual([
      ["jdoe", "stormy"],
      ["lead", "stormy"],
      ["chloe", "sunny"],
    ])
    const jdoe = rows[0]
    expect(jdoe.blocked).toHaveLength(2)
    expect(jdoe.waitingOn).toEqual(["lead", "team:leads", "chloe"])
    expect(rows[1]).toMatchObject({
      isViewer: true,
      reviewsDue: 7,
      openPulls: 2,
    })
    // A draft's reviewers are not counted as due.
    expect(rows[2].reviewsDue).toBe(1)
  })

  it("grades the weather", () => {
    expect(weatherFor(0, 0)).toBe("sunny")
    expect(weatherFor(3, 0)).toBe("cloudy")
    expect(weatherFor(0, 2)).toBe("stormy")
  })
})
