import { describe, expect, it } from "vitest"
import { teamProblems } from "./pulls"
import type { RawTeamPull } from "./pulls"

const NOW = new Date("2026-10-12T12:00:00Z")

function pull(overrides: Partial<RawTeamPull> = {}): RawTeamPull {
  return {
    number: 4,
    title: "Add export",
    url: "https://github.com/acme/api/pull/4",
    createdAt: "2026-10-11T09:00:00Z",
    updatedAt: "2026-10-12T09:00:00Z",
    isDraft: false,
    additions: 10,
    deletions: 2,
    author: { login: "dev" },
    reviewDecision: null,
    mergeable: "MERGEABLE",
    reviewRequests: { nodes: [{ requestedReviewer: { login: "lead" } }] },
    reviews: { totalCount: 0 },
    commits: {
      nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }],
    },
    ...overrides,
  }
}

describe("teamProblems", () => {
  it("finds nothing on a healthy PR", () => {
    expect(teamProblems(pull(), NOW, 7)).toEqual([])
  })

  it("flags a PR nobody was asked to review", () => {
    expect(
      teamProblems(pull({ reviewRequests: { nodes: [] } }), NOW, 7)
    ).toEqual(["no-reviewer"])
    expect(
      teamProblems(
        pull({ reviewRequests: { nodes: [] }, reviews: { totalCount: 1 } }),
        NOW,
        7
      )
    ).toEqual([])
  })

  it("flags failing CI, conflicts, idle requested changes and old PRs", () => {
    expect(
      teamProblems(
        pull({
          createdAt: "2026-09-01T09:00:00Z",
          updatedAt: "2026-10-05T09:00:00Z",
          reviewDecision: "CHANGES_REQUESTED",
          mergeable: "CONFLICTING",
          commits: {
            nodes: [{ commit: { statusCheckRollup: { state: "FAILURE" } } }],
          },
        }),
        NOW,
        7
      )
    ).toEqual(["changes", "ci", "conflict", "stale"])
  })

  it("leaves drafts alone", () => {
    expect(
      teamProblems(
        pull({ isDraft: true, reviewRequests: { nodes: [] } }),
        NOW,
        7
      )
    ).toEqual([])
  })
})
