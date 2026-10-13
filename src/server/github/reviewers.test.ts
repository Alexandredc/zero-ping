import { describe, expect, it } from "vitest"
import { reviewerChanges, splitReviewers, toReviewerOptions } from "./reviewers"
import type { RawReviewerOptions } from "./reviewers"

const raw: RawReviewerOptions = {
  pullRequest: {
    author: { login: "jdoe" },
    suggestedReviewers: [{ reviewer: { login: "Zoe", name: "Zoé" } }],
    reviewRequests: {
      nodes: [
        { requestedReviewer: { login: "lead", name: "Lead" } },
        { requestedReviewer: { slug: "backend" } },
      ],
    },
    latestOpinionatedReviews: {
      nodes: [{ author: { login: "alice" }, state: "APPROVED" }],
    },
  },
  assignableUsers: {
    nodes: [
      { login: "jdoe", name: null },
      { login: "bob", name: "" },
      { login: "alice", name: "Alice" },
      { login: "zoe", name: "Zoé" },
    ],
  },
}

describe("toReviewerOptions", () => {
  it("ranks suggestions, then past reviewers, and never offers the author", () => {
    const options = toReviewerOptions(
      raw,
      [{ slug: "front", name: "Front" }],
      "Lead",
      "fr"
    )
    expect(options.requested).toEqual(["lead", "team:backend"])
    expect(options.candidates.map((c) => c.id)).toEqual([
      "Zoe",
      "alice",
      "bob",
      "lead",
      "team:backend",
      "team:front",
    ])
    expect(options.candidates[0].suggested).toBe(true)
    expect(options.candidates[1].reviewState).toBe("APPROVED")
    expect(options.candidates[2].name).toBeNull()
    expect(options.candidates[3].label).toBe("@lead (toi)")
    expect(options.candidates[4].label).toBe("équipe backend")
  })

  it("labels the viewer and teams in English", () => {
    const options = toReviewerOptions(raw, [], "Lead", "en")
    const labels = options.candidates.map((c) => c.label)
    expect(labels).toContain("@lead (you)")
    expect(labels).toContain("team backend")
  })
})

describe("reviewerChanges", () => {
  it("adds and withdraws only what differs, ignoring case", () => {
    expect(reviewerChanges(["Lead", "team:backend"], ["lead", "bob"])).toEqual({
      add: ["bob"],
      remove: ["team:backend"],
    })
  })
})

describe("splitReviewers", () => {
  it("separates logins from team slugs", () => {
    expect(splitReviewers(["bob", "team:backend"])).toEqual({
      reviewers: ["bob"],
      team_reviewers: ["backend"],
    })
  })
})
