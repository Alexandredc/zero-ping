import { describe, expect, it } from "vitest"
import { toMergeInfo } from "./merge"
import { messagesFor } from "@/lib/i18n/messages"

const fr = messagesFor("fr")

const raw = {
  squashMergeAllowed: true,
  mergeCommitAllowed: false,
  rebaseMergeAllowed: true,
  deleteBranchOnMerge: false,
  viewerDefaultMergeMethod: "MERGE" as const,
  pullRequest: {
    title: "Add export",
    mergeStateStatus: "CLEAN",
    headRefName: "feat/export",
    isCrossRepository: false,
  },
}

describe("toMergeInfo", () => {
  it("offers the allowed methods and falls back from a disallowed default", () => {
    const info = toMergeInfo(raw, fr)
    expect(info.methods).toEqual(["SQUASH", "REBASE"])
    expect(info.defaultMethod).toBe("SQUASH")
    expect(info.canMerge).toBe(true)
    expect(info.blockedReason).toBeNull()
  })

  it("accepts non-required failing checks but explains real blocks", () => {
    const unstable = { ...raw.pullRequest, mergeStateStatus: "UNSTABLE" }
    expect(toMergeInfo({ ...raw, pullRequest: unstable }, fr).canMerge).toBe(
      true
    )
    const dirtyRaw = {
      ...raw,
      pullRequest: { ...raw.pullRequest, mergeStateStatus: "DIRTY" },
    }
    const dirty = toMergeInfo(dirtyRaw, fr)
    expect(dirty.canMerge).toBe(false)
    expect(dirty.blockedReason).toMatch(/Conflits/)
    expect(toMergeInfo(dirtyRaw, messagesFor("en")).blockedReason).toBe(
      "Conflicts with the base branch: resolve them before merging."
    )
  })
})
