import { describe, expect, it } from "vitest"
import { normalizeSubject, uatLedger, uatStatus } from "./uat"

const at = (hour: number) =>
  `2026-10-13T${String(hour).padStart(2, "0")}:00:00Z`

// Newest first, as GitHub lists them.
const uat = uatLedger([
  { oid: "e", headline: 'Revert "fix: c"', committedDate: at(14) },
  { oid: "d", headline: "fix: c", committedDate: at(13) },
  { oid: "c", headline: "feat: b", committedDate: at(12) },
  { oid: "b", headline: 'Revert "feat: a"', committedDate: at(11) },
  { oid: "a", headline: "feat: a", committedDate: at(10) },
  { oid: "s", headline: "feat: squashed (#42)", committedDate: at(9) },
])

const commit = (headline: string, hour = 8, isMerge = false) => ({
  headline,
  committedDate: at(hour),
  isMerge,
})

describe("normalizeSubject", () => {
  it("drops the PR number a squash appends", () => {
    expect(normalizeSubject(" feat: x (#123) ")).toBe("feat: x")
  })
})

describe("uatStatus", () => {
  it("finds a cherry-picked commit by its subject", () => {
    expect(
      uatStatus({ title: "B", commits: [commit("feat: b")] }, uat)
    ).toMatchObject({ state: "deployed", shipped: 1, total: 1, at: at(12) })
  })

  it("leaves merge commits out and names what is missing", () => {
    expect(
      uatStatus(
        {
          title: "B",
          commits: [
            commit("feat: b"),
            commit("Merge branch 'development'", 8, true),
            commit("fix: review"),
          ],
        },
        uat
      )
    ).toMatchObject({
      state: "partial",
      shipped: 1,
      total: 2,
      missing: ["fix: review"],
    })
  })

  it("tells a reverted deploy from one that never happened", () => {
    expect(
      uatStatus({ title: "A", commits: [commit("feat: a")] }, uat).state
    ).toBe("reverted")
    expect(
      uatStatus({ title: "Z", commits: [commit("feat: z")] }, uat).state
    ).toBe("absent")
  })

  it("flags a commit rewritten after its deploy", () => {
    expect(
      uatStatus({ title: "B", commits: [commit("feat: b", 15)] }, uat)
    ).toMatchObject({ state: "deployed", outdated: ["feat: b"] })
  })

  it("falls back on the PR title for a squash shipped from development", () => {
    expect(
      uatStatus(
        { title: "feat: squashed", commits: [commit("wip"), commit("wip 2")] },
        uat
      )
    ).toMatchObject({ state: "deployed", shipped: 2, total: 2 })
  })
})
