import { describe, expect, it } from "vitest"
import { checkState, runIdFromUrl, summarizeChecks } from "./checks"

describe("runIdFromUrl", () => {
  it("reads the workflow run of a GitHub Actions job", () => {
    expect(
      runIdFromUrl("https://github.com/acme/api/actions/runs/123/job/456")
    ).toBe(123)
  })

  it("returns null for external CI", () => {
    expect(runIdFromUrl("https://ci.example.com/build/9")).toBeNull()
    expect(runIdFromUrl(null)).toBeNull()
  })
})

describe("checkState", () => {
  it("reads check runs and commit statuses alike", () => {
    expect(
      checkState({ kind: "run", status: "in_progress", conclusion: null })
    ).toBe("pending")
    expect(
      checkState({ kind: "run", status: "completed", conclusion: "neutral" })
    ).toBe("passed")
    expect(
      checkState({ kind: "run", status: "completed", conclusion: "skipped" })
    ).toBe("skipped")
    expect(
      checkState({ kind: "run", status: "completed", conclusion: "timed_out" })
    ).toBe("failed")
    expect(checkState({ kind: "status", state: "error" })).toBe("failed")
    expect(checkState({ kind: "status", state: "pending" })).toBe("pending")
  })
})

describe("summarizeChecks", () => {
  it("counts each state and names what still runs", () => {
    expect(
      summarizeChecks([
        { name: "lint", state: "passed" },
        { name: "e2e", state: "pending" },
        { name: "deploy", state: "skipped" },
      ])
    ).toEqual({
      passed: 1,
      failed: 0,
      pending: 1,
      skipped: 1,
      running: ["e2e"],
    })
  })
})
