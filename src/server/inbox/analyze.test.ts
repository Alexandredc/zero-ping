import { describe, expect, it } from "vitest"
import { analyze, findAwaiting } from "./analyze"
import type { Comment, SubjectDetails, Viewer } from "./analyze"

const viewer: Viewer = { login: "lead", teams: ["acme/backend"] }

let sequence = 0
function comment(author: string, body: string, createdAt: string): Comment {
  sequence += 1
  return {
    id: `c${sequence}`,
    databaseId: sequence,
    author,
    body,
    createdAt,
    url: `https://github.com/acme/api/pull/1#issuecomment-${sequence}`,
  }
}

function pr(overrides: Partial<SubjectDetails> = {}): SubjectDetails {
  return {
    kind: "PullRequest",
    title: "Add retries",
    url: "https://github.com/acme/api/pull/1",
    body: "",
    createdAt: "2026-10-01T09:00:00Z",
    state: "OPEN",
    isDraft: false,
    author: "dev",
    labels: [],
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    headOid: "head",
    reviews: [],
    ciState: "SUCCESS",
    reviewDecision: null,
    reviewRequests: [],
    reviewRequestedAt: [],
    approvals: 0,
    comments: [],
    reviewThreads: [],
    ...overrides,
  }
}

describe("findAwaiting", () => {
  it("returns the latest unanswered mention with a deep link", () => {
    const question = comment(
      "dev",
      "@lead should we keep the old flag?",
      "2026-10-02T10:00:00Z"
    )
    const awaiting = findAwaiting(pr({ comments: [question] }), viewer)
    expect(awaiting).toMatchObject({
      url: question.url,
      from: "dev",
      since: new Date("2026-10-02T10:00:00Z"),
    })
  })

  it("ignores mentions the viewer already answered", () => {
    const comments = [
      comment("dev", "@lead thoughts?", "2026-10-02T10:00:00Z"),
      comment("lead", "Looks fine", "2026-10-02T11:00:00Z"),
    ]
    expect(findAwaiting(pr({ comments }), viewer)).toBeNull()
  })

  it("matches team mentions but not longer handles", () => {
    expect(
      findAwaiting(
        pr({
          comments: [
            comment("dev", "cc @acme/backend", "2026-10-02T10:00:00Z"),
          ],
        }),
        viewer
      )
    ).not.toBeNull()
    expect(
      findAwaiting(
        pr({
          comments: [comment("dev", "ping @leader", "2026-10-02T10:00:00Z")],
        }),
        viewer
      )
    ).toBeNull()
  })

  it("follows replies in review threads the viewer took part in", () => {
    const thread = {
      isResolved: false,
      comments: [
        comment("lead", "Why not a map here?", "2026-10-02T10:00:00Z"),
        comment("dev", "Because order matters", "2026-10-02T12:00:00Z"),
      ],
    }
    const reviewed = pr({ author: "dev", reviewThreads: [thread] })
    expect(findAwaiting(reviewed, viewer)).toMatchObject({
      from: "dev",
      excerpt: "Because order matters",
    })
    expect(
      findAwaiting(
        { ...reviewed, reviewThreads: [{ ...thread, isResolved: true }] },
        viewer
      )
    ).toBeNull()
  })

  it("ignores review threads between other people", () => {
    const thread = {
      isResolved: false,
      comments: [
        comment("alice", "Nit: rename", "2026-10-02T10:00:00Z"),
        comment("dev", "Done", "2026-10-02T11:00:00Z"),
      ],
    }
    expect(
      findAwaiting(pr({ author: "dev", reviewThreads: [thread] }), viewer)
    ).toBeNull()
  })

  it("surfaces new review threads on the viewer's own PR", () => {
    const thread = {
      isResolved: false,
      comments: [
        comment("alice", "This leaks the connection", "2026-10-03T10:00:00Z"),
      ],
    }
    expect(
      findAwaiting(pr({ author: "lead", reviewThreads: [thread] }), viewer)
    ).toMatchObject({
      from: "alice",
    })
  })

  it("ignores replies in the main conversation that do not mention the viewer", () => {
    const comments = [
      comment("lead", "LGTM once CI passes", "2026-10-02T10:00:00Z"),
      comment("dev", "@alice can you rebase?", "2026-10-02T11:00:00Z"),
    ]
    expect(findAwaiting(pr({ comments }), viewer)).toBeNull()
  })
})

describe("analyze", () => {
  it("classifies a direct review request and its request date", () => {
    const analysis = analyze(
      pr({
        reviewRequests: [{ user: "Lead" }],
        reviewRequestedAt: [
          { reviewer: { user: "lead" }, createdAt: "2026-10-01T09:00:00Z" },
          { reviewer: { user: "someone" }, createdAt: "2026-10-05T09:00:00Z" },
        ],
      }),
      viewer
    )
    expect(analysis).toMatchObject({
      view: "review",
      reviewRequest: "direct",
      requestedAt: new Date("2026-10-01T09:00:00Z"),
    })
  })

  it("classifies a team request as a team review", () => {
    expect(
      analyze(pr({ reviewRequests: [{ team: "acme/backend" }] }), viewer)
        .reviewRequest
    ).toBe("team")
  })

  it("drops review requests that were fulfilled or on closed PRs", () => {
    expect(analyze(pr(), viewer).view).toBe("other")
    expect(
      analyze(
        pr({ state: "MERGED", reviewRequests: [{ user: "lead" }] }),
        viewer
      ).view
    ).toBe("other")
  })

  it("files the viewer's own open PR under mine", () => {
    expect(analyze(pr({ author: "lead" }), viewer).view).toBe("mine")
  })
})

describe("re-review", () => {
  const review = (state: string, commitOid: string) => ({
    author: "lead",
    state,
    submittedAt: "2026-10-03T10:00:00Z",
    commitOid,
  })

  it("brings back a PR whose requested changes got new commits", () => {
    const analysis = analyze(
      pr({ headOid: "new", reviews: [review("CHANGES_REQUESTED", "old")] }),
      viewer
    )
    expect(analysis.view).toBe("review")
    expect(analysis.lastReview).toMatchObject({ oid: "old", newCommits: true })
  })

  it("only flags new commits after an approval", () => {
    const analysis = analyze(
      pr({ headOid: "new", reviews: [review("APPROVED", "old")] }),
      viewer
    )
    expect(analysis.view).toBe("other")
    expect(analysis.lastReview?.newCommits).toBe(true)
  })

  it("keeps the latest of the viewer's reviews and ignores others", () => {
    const analysis = analyze(
      pr({
        headOid: "head",
        reviews: [
          review("CHANGES_REQUESTED", "old"),
          {
            ...review("APPROVED", "head"),
            submittedAt: "2026-10-04T10:00:00Z",
          },
          { ...review("CHANGES_REQUESTED", "x"), author: "someone" },
        ],
      }),
      viewer
    )
    expect(analysis.lastReview).toMatchObject({
      state: "APPROVED",
      newCommits: false,
    })
    expect(analysis.view).toBe("other")
  })

  it("keeps a change request behind a later thread reply", () => {
    const analysis = analyze(
      pr({
        headOid: "new",
        reviews: [
          review("CHANGES_REQUESTED", "old"),
          {
            ...review("COMMENTED", "old"),
            submittedAt: "2026-10-04T10:00:00Z",
          },
        ],
      }),
      viewer
    )
    expect(analysis.lastReview?.state).toBe("CHANGES_REQUESTED")
    expect(analysis.view).toBe("review")
  })
})
