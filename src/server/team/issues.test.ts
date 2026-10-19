import { describe, expect, it, vi } from "vitest"
import { fetchRepoIssues, mergeIssues, pageOf, teamIssueToItem } from "./issues"
import type { RawTeamIssue } from "./issues"
import type { InboxItem } from "@/server/inbox/actions"

function issue(overrides: Partial<RawTeamIssue> = {}): RawTeamIssue {
  return {
    number: 7,
    title: "Export fails on empty carts",
    url: "https://github.com/acme/api/issues/7",
    updatedAt: "2026-10-12T09:00:00Z",
    author: { login: "dev" },
    labels: { nodes: [{ name: "bug" }] },
    ...overrides,
  }
}

const page = (numbers: number[], endCursor: string | null = null) => ({
  repository: {
    issues: {
      pageInfo: { hasNextPage: endCursor !== null, endCursor },
      nodes: numbers.map((number) => issue({ number })),
    },
  },
})

describe("fetchRepoIssues", () => {
  it("follows the pages of one repo", async () => {
    const graphql = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2], "c1"))
      .mockResolvedValueOnce(page([3]))
    const issues = await fetchRepoIssues({ graphql } as never, "acme/api")
    expect(
      issues.map(({ repo, issue: { number } }) => `${repo}#${number}`)
    ).toEqual(["acme/api#1", "acme/api#2", "acme/api#3"])
    expect(graphql).toHaveBeenLastCalledWith(expect.any(String), {
      owner: "acme",
      name: "api",
      after: "c1",
    })
  })

  it("stops after the asked number of issues", async () => {
    const graphql = vi.fn().mockResolvedValue(page([1, 2], "c1"))
    const issues = await fetchRepoIssues({ graphql } as never, "acme/api", 2)
    expect(issues).toHaveLength(2)
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it("returns nothing for a deleted repo, and fails on other errors", async () => {
    const gone = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("NOT_FOUND"), { data: { repository: null } })
      )
    expect(
      await fetchRepoIssues({ graphql: gone } as never, "acme/gone")
    ).toEqual([])
    const refused = vi.fn().mockRejectedValue(new Error("Bad credentials"))
    await expect(
      fetchRepoIssues({ graphql: refused } as never, "acme/api")
    ).rejects.toThrow("Bad credentials")
  })
})

describe("teamIssueToItem", () => {
  it("shapes an issue like an inbox item", () => {
    const item = teamIssueToItem("acme/api", issue())
    expect(item).toMatchObject({
      key: "acme/api#7",
      kind: "Issue",
      number: 7,
      author: "dev",
      labels: ["bug"],
      htmlUrl: "https://github.com/acme/api/issues/7",
      state: "OPEN",
    })
    expect(item.updatedAt).toEqual(new Date("2026-10-12T09:00:00Z"))
  })
})

describe("mergeIssues", () => {
  const fetched = [
    teamIssueToItem("acme/api", issue({ number: 1 })),
    teamIssueToItem(
      "acme/web",
      issue({ number: 2, updatedAt: "2026-10-14T09:00:00Z" })
    ),
  ]

  it("keeps the inbox's item, adds the others, the most recent first", () => {
    const known: InboxItem = {
      ...fetched[0],
      priority: 60,
      slackDiscussions: 1,
      inInbox: true,
      jevUrgency: 2,
    }
    const merged = mergeIssues(new Map([[known.key, known]]), fetched)
    expect(merged.map((item) => [item.key, item.inInbox])).toEqual([
      ["acme/web#2", false],
      ["acme/api#1", true],
    ])
    expect(merged[1].priority).toBe(60)
  })

  it("keeps one repo's issues", () => {
    expect(
      mergeIssues(new Map(), fetched, "acme/api").map((item) => item.key)
    ).toEqual(["acme/api#1"])
  })
})

describe("pageOf", () => {
  const all = Array.from({ length: 5 }, (_, index) => ({
    ...teamIssueToItem("acme/api", issue({ number: index + 1 })),
    slackDiscussions: null,
    inInbox: false,
    jevUrgency: null,
  }))

  it("cuts a page and points at the next one", () => {
    const sliced = pageOf(all, { offset: 0, limit: 2 })
    expect(sliced.items.map((item) => item.number)).toEqual([1, 2])
    expect(sliced).toMatchObject({ total: 5, nextOffset: 2 })
  })

  it("ends on the last page", () => {
    const sliced = pageOf(all, { offset: 4, limit: 2 })
    expect(sliced.items.map((item) => item.number)).toEqual([5])
    expect(sliced.nextOffset).toBeNull()
  })
})
