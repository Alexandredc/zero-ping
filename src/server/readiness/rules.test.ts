import { describe, expect, it } from "vitest"
import { assessReadiness, readinessGaps, withWait } from "./rules"
import type { ReadinessFacts } from "./rules"

const APPROVED_AT = "2026-10-15T10:00:00Z"

function facts(overrides: Partial<ReadinessFacts> = {}): ReadinessFacts {
  return {
    isDraft: false,
    reviewDecision: "APPROVED",
    mergeStateStatus: "CLEAN",
    lastCommitAt: "2026-10-15T09:00:00Z",
    reviews: [{ state: "APPROVED", submittedAt: APPROVED_AT }],
    reviewThreads: [{ isResolved: true }],
    ...overrides,
  }
}

describe("readinessGaps", () => {
  it("finds nothing on an approved, clean PR", () => {
    expect(readinessGaps(facts())).toEqual([])
    expect(assessReadiness(facts())).toEqual({
      status: "ready",
      gaps: [],
      waitHash: null,
    })
  })

  it("flags a draft and a missing approval", () => {
    expect(
      readinessGaps(
        facts({
          isDraft: true,
          reviewDecision: null,
          mergeStateStatus: "DRAFT",
        })
      )
    ).toEqual([{ kind: "draft" }, { kind: "review", decision: null }])
    expect(
      readinessGaps(facts({ reviewDecision: "CHANGES_REQUESTED" }))
    ).toEqual([{ kind: "review", decision: "CHANGES_REQUESTED" }])
  })

  it("flags a commit pushed after the latest approval", () => {
    expect(
      readinessGaps(facts({ lastCommitAt: "2026-10-15T11:00:00Z" }))
    ).toEqual([{ kind: "commit-after-approval" }])
    // A newer approval covers the commit again.
    expect(
      readinessGaps(
        facts({
          lastCommitAt: "2026-10-15T11:00:00Z",
          reviews: [
            { state: "APPROVED", submittedAt: APPROVED_AT },
            { state: "COMMENTED", submittedAt: "2026-10-15T13:00:00Z" },
            { state: "APPROVED", submittedAt: "2026-10-15T12:00:00Z" },
          ],
        })
      )
    ).toEqual([])
  })

  it("counts the unresolved review threads", () => {
    expect(
      readinessGaps(
        facts({
          reviewThreads: [
            { isResolved: false },
            { isResolved: true },
            { isResolved: false },
          ],
        })
      )
    ).toEqual([{ kind: "threads", count: 2 }])
  })

  it("turns the merge state into a readable gap", () => {
    for (const [status, kind] of [
      ["BEHIND", "behind"],
      ["BLOCKED", "blocked"],
      ["UNSTABLE", "unstable"],
      ["DIRTY", "dirty"],
    ] as const)
      expect(readinessGaps(facts({ mergeStateStatus: status }))).toEqual([
        { kind },
      ])
  })

  it("does not repeat a block that the approval or a thread explains", () => {
    expect(
      readinessGaps(
        facts({
          reviewDecision: "REVIEW_REQUIRED",
          mergeStateStatus: "BLOCKED",
        })
      )
    ).toEqual([{ kind: "review", decision: "REVIEW_REQUIRED" }])
    expect(
      readinessGaps(
        facts({
          mergeStateStatus: "BLOCKED",
          reviewThreads: [{ isResolved: false }],
        })
      )
    ).toEqual([{ kind: "threads", count: 1 }])
  })

  it("lists every gap together, most blocking first", () => {
    expect(
      readinessGaps(
        facts({
          lastCommitAt: "2026-10-16T08:00:00Z",
          mergeStateStatus: "BEHIND",
          reviewThreads: [{ isResolved: false }, { isResolved: false }],
        })
      )
    ).toEqual([
      { kind: "commit-after-approval" },
      { kind: "threads", count: 2 },
      { kind: "behind" },
    ])
  })
})

describe("assessReadiness", () => {
  it("does not count an unknown merge state as a gap", () => {
    expect(assessReadiness(facts({ mergeStateStatus: "UNKNOWN" }))).toEqual({
      status: "computing",
      gaps: [],
      waitHash: null,
    })
    expect(assessReadiness(facts({ mergeStateStatus: null })).status).toBe(
      "computing"
    )
  })

  it("accepts pre-receive hooks as clean", () => {
    expect(
      assessReadiness(facts({ mergeStateStatus: "HAS_HOOKS" })).status
    ).toBe("ready")
  })

  it("says almost with the gaps", () => {
    expect(assessReadiness(facts({ mergeStateStatus: "DIRTY" }))).toEqual({
      status: "almost",
      gaps: [{ kind: "dirty" }],
      waitHash: null,
    })
  })
})

describe("withWait", () => {
  const ready = assessReadiness(facts())
  const wait = { kind: "wait", reason: "dependency", pull: 10569 } as const

  it("turns a ready PR into almost when Jev says to wait", () => {
    expect(withWait(ready, { gap: wait, hash: "h" })).toEqual({
      status: "almost",
      gaps: [wait],
      waitHash: "h",
    })
    expect(withWait(ready, { gap: null, hash: "h" })).toEqual({
      ...ready,
      waitHash: "h",
    })
  })

  it("leaves a PR the rules block as it is", () => {
    const blocked = assessReadiness(facts({ mergeStateStatus: "BEHIND" }))
    expect(withWait(blocked, { gap: wait, hash: "h" })).toBe(blocked)
  })
})
