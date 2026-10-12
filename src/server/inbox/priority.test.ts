import { describe, expect, it } from "vitest"
import { computePriority } from "./priority"
import type { PriorityInput } from "./priority"

const NOW = new Date("2026-10-12T12:00:00Z")

const base: PriorityInput = {
  kind: "PullRequest",
  view: "review",
  isDraft: false,
  state: "OPEN",
  labels: [],
  additions: 300,
  deletions: 50,
  ciState: "SUCCESS",
  reviewDecision: null,
  reviewRequest: null,
  approvals: 0,
  pendingReviewers: 0,
  headOid: "head",
  reviewedOid: null,
  reviewedState: null,
  awaitingMe: false,
  waitingSince: null,
  aiUrgency: null,
  aiConfidence: null,
  aiQuestionProbability: null,
}

const labels = (input: Partial<PriorityInput>) =>
  computePriority({ ...base, ...input }, NOW).reasons.map(
    (reason) => reason.label
  )

describe("computePriority", () => {
  it("ranks a direct review request above a team request", () => {
    const direct = computePriority({ ...base, reviewRequest: "direct" }, NOW)
    const team = computePriority({ ...base, reviewRequest: "team" }, NOW)
    expect(direct.priority).toBeGreaterThan(team.priority)
  })

  it("flags the viewer as the last missing reviewer", () => {
    expect(
      labels({ reviewRequest: "direct", approvals: 1, pendingReviewers: 1 })
    ).toContain("Il ne manque que ta review")
    expect(
      labels({ reviewRequest: "direct", approvals: 0, pendingReviewers: 1 })
    ).not.toContain("Il ne manque que ta review")
  })

  it("grows with the waiting time, capped at 20 points", () => {
    const fiveDays = computePriority(
      { ...base, waitingSince: new Date("2026-10-07T12:00:00Z") },
      NOW
    )
    expect(fiveDays.reasons).toContainEqual(
      expect.objectContaining({
        label: "En attente depuis 5 j",
        weight: 20,
      })
    )
    const twoDays = computePriority(
      { ...base, waitingSince: new Date("2026-10-10T12:00:00Z") },
      NOW
    )
    expect(twoDays.reasons).toContainEqual(
      expect.objectContaining({
        label: "En attente depuis 2 j",
        weight: 8,
      })
    )
  })

  it("boosts urgent labels and small PRs, and lowers drafts", () => {
    expect(labels({ labels: ["Hotfix"] })).toContain("Label urgent")
    expect(labels({ labels: ["hotfixes-doc"] })).not.toContain("Label urgent")
    expect(labels({ additions: 40, deletions: 10 })).toContain("Petite PR")
    expect(
      computePriority({ ...base, reviewRequest: "direct", isDraft: true }, NOW)
        .priority
    ).toBe(10)
  })

  it("treats a failing CI as a reason to act on the viewer's own PR only", () => {
    const review = computePriority({ ...base, ciState: "FAILURE" }, NOW)
    const mine = computePriority(
      { ...base, view: "mine", ciState: "FAILURE" },
      NOW
    )
    expect(review.reasons).toContainEqual(
      expect.objectContaining({ label: "CI en échec", weight: -10 })
    )
    expect(mine.reasons).toContainEqual(
      expect.objectContaining({ label: "CI en échec", weight: 15 })
    )
  })

  it("ignores a low-confidence AI urgency and asks for a check", () => {
    const confident = computePriority(
      { ...base, aiUrgency: 3, aiConfidence: 0.9 },
      NOW
    )
    expect(confident.reasons).toContainEqual(
      expect.objectContaining({
        label: "IA : bloquante ou urgente",
        weight: 30,
      })
    )
    const unsure = computePriority(
      { ...base, aiUrgency: 3, aiConfidence: 0.2 },
      NOW
    )
    expect(unsure.priority).toBe(0)
    expect(unsure.needsCheck).toBe(true)
  })

  it("scores closed subjects at zero and clamps to 100", () => {
    expect(
      computePriority(
        { ...base, state: "MERGED", reviewRequest: "direct" },
        NOW
      ).priority
    ).toBe(0)
    const everything = computePriority(
      {
        ...base,
        reviewRequest: "direct",
        approvals: 2,
        pendingReviewers: 1,
        awaitingMe: true,
        labels: ["urgent"],
        additions: 10,
        deletions: 0,
        waitingSince: new Date("2026-09-01T00:00:00Z"),
        aiUrgency: 3,
        aiConfidence: 1,
      },
      NOW
    )
    expect(everything.priority).toBe(100)
  })
})

describe("priority reasons", () => {
  it("explain every rule they apply", () => {
    const { reasons } = computePriority(
      {
        ...base,
        reviewRequest: "direct",
        approvals: 1,
        pendingReviewers: 1,
        awaitingMe: true,
        aiQuestionProbability: 0.9,
        labels: ["urgent"],
        additions: 10,
        deletions: 0,
        ciState: "FAILURE",
        isDraft: true,
        waitingSince: new Date("2026-10-01T00:00:00Z"),
        aiUrgency: 2,
        aiConfidence: 0.8,
      },
      NOW
    )
    expect(reasons.length).toBeGreaterThan(8)
    for (const reason of reasons) expect(reason.hint).toBeTruthy()
  })

  it("ranks pushed fixes after requested changes like a review request", () => {
    const fixes = { reviewedOid: "old", reviewedState: "CHANGES_REQUESTED" }
    expect(labels(fixes)).toContain("Corrections poussées")
    expect(labels({ ...fixes, reviewedOid: "head" })).not.toContain(
      "Corrections poussées"
    )
  })

  it("marks a renewed review request as a re-review", () => {
    expect(
      labels({
        reviewRequest: "direct",
        reviewedOid: "old",
        reviewedState: "APPROVED",
      })
    ).toContain("Re-review")
  })
})
