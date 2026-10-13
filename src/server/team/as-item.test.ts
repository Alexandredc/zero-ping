import { describe, expect, it } from "vitest"
import { subjectToItem, teamPullToItem } from "./as-item"

describe("teamPullToItem", () => {
  it("shapes a team PR as an open, read, unprioritised inbox item", () => {
    const item = teamPullToItem({
      key: "acme/app#12",
      repoFullName: "acme/app",
      number: 12,
      title: "feat: export",
      htmlUrl: "https://github.com/acme/app/pull/12",
      author: "robin",
      isDraft: false,
      createdAt: new Date("2026-10-01T10:00:00Z"),
      updatedAt: new Date("2026-10-12T10:00:00Z"),
      additions: 40,
      deletions: 2,
      reviewers: ["lead"],
      reviewDecision: null,
      ciState: "FAILURE",
      mergeable: "MERGEABLE",
      problems: ["ci"],
      syncedAt: new Date("2026-10-12T11:00:00Z"),
    })
    expect(item).toMatchObject({
      key: "acme/app#12",
      kind: "PullRequest",
      state: "OPEN",
      view: "other",
      unread: false,
      author: "robin",
      ciState: "FAILURE",
      pendingReviewers: 1,
      priority: 0,
      doneAt: null,
    })
  })
})

describe("subjectToItem", () => {
  it("keeps the issue's kind, repo and number for the Slack search", () => {
    expect(
      subjectToItem({
        key: "acme/app#7",
        kind: "Issue",
        title: "Peak season",
        url: "https://github.com/acme/app/issues/7",
      })
    ).toMatchObject({
      key: "acme/app#7",
      kind: "Issue",
      repoFullName: "acme/app",
      number: 7,
      htmlUrl: "https://github.com/acme/app/issues/7",
    })
  })
})
