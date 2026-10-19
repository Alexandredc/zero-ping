import { describe, expect, it, vi } from "vitest"
import {
  fetchRepoPulls,
  teamProblems,
  teamReadiness,
  toScoreSubject,
} from "./pulls"
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
    mergeStateStatus: "CLEAN",
    reviewRequests: { nodes: [{ requestedReviewer: { login: "lead" } }] },
    reviews: { totalCount: 0 },
    approvals: { nodes: [] },
    reviewThreads: { nodes: [] },
    body: "Adds a CSV export.",
    labels: { nodes: [{ name: "feature" }] },
    comments: { nodes: [{ author: { login: "lead" }, body: "Looks good" }] },
    discussion: { nodes: [] },
    commits: {
      nodes: [
        {
          commit: {
            committedDate: "2026-10-11T09:00:00Z",
            statusCheckRollup: { state: "SUCCESS" },
          },
        },
      ],
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
            nodes: [
              {
                commit: {
                  committedDate: null,
                  statusCheckRollup: { state: "FAILURE" },
                },
              },
            ],
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

describe("toScoreSubject", () => {
  it("gives Jev the description, labels, CI and latest comments", () => {
    expect(toScoreSubject("acme/api", pull())).toEqual({
      key: "acme/api#4",
      kind: "PullRequest",
      title: "Add export",
      url: "https://github.com/acme/api/pull/4",
      body: "Adds a CSV export.",
      author: "dev",
      labels: ["feature"],
      isDraft: false,
      additions: 10,
      deletions: 2,
      ciState: "SUCCESS",
      comments: [{ author: "lead", body: "Looks good" }],
    })
  })
})

describe("teamReadiness", () => {
  it("reads the merge rules from the team query", () => {
    expect(
      teamReadiness(
        pull({
          reviewDecision: "APPROVED",
          approvals: {
            nodes: [{ state: "APPROVED", submittedAt: "2026-10-12T08:00:00Z" }],
          },
        })
      )
    ).toEqual({ status: "ready", gaps: [], waitHash: null })
  })

  it("lists what a teammate's PR still misses", () => {
    expect(
      teamReadiness(
        pull({
          reviewDecision: "APPROVED",
          mergeStateStatus: "BEHIND",
          approvals: {
            nodes: [{ state: "APPROVED", submittedAt: "2026-10-10T08:00:00Z" }],
          },
          reviewThreads: { nodes: [{ isResolved: false }] },
        })
      ).gaps
    ).toEqual([
      { kind: "commit-after-approval" },
      { kind: "threads", count: 1 },
      { kind: "behind" },
    ])
  })
})

describe("fetchRepoPulls", () => {
  const page = (numbers: number[], endCursor: string | null = null) => ({
    repository: {
      pullRequests: {
        pageInfo: { hasNextPage: endCursor !== null, endCursor },
        nodes: numbers.map((number) => pull({ number })),
      },
    },
  })

  it("asks one repo at a time and follows the pages", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2], "c1"))
      .mockResolvedValueOnce(page([3]))
    const pulls = await fetchRepoPulls({ graphql } as never, "acme/api")
    expect(
      pulls.map(({ repo, pull: { number } }) => `${repo}#${number}`)
    ).toEqual(["acme/api#1", "acme/api#2", "acme/api#3"])
    expect(graphql).toHaveBeenNthCalledWith(1, expect.any(String), {
      owner: "acme",
      name: "api",
      after: null,
    })
    expect(graphql).toHaveBeenNthCalledWith(2, expect.any(String), {
      owner: "acme",
      name: "api",
      after: "c1",
    })
  })

  it("returns nothing for a deleted repo", async () => {
    const graphql = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("NOT_FOUND"), { data: { repository: null } })
      )
    expect(await fetchRepoPulls({ graphql } as never, "acme/gone")).toEqual([])
  })

  it("fails on a refused query instead of keeping half-empty PRs", async () => {
    const graphql = vi.fn().mockRejectedValue(
      Object.assign(new Error("RESOURCE_LIMITS_EXCEEDED"), {
        data: page([1]),
      })
    )
    await expect(
      fetchRepoPulls({ graphql } as never, "acme/api")
    ).rejects.toThrow("RESOURCE_LIMITS_EXCEEDED")
  })
})
