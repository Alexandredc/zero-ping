import { describe, expect, it } from "vitest"
import { runIdFromUrl } from "./checks"

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
