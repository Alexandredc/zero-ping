import { describe, expect, it } from "vitest"
import { filesChangedSinceRewrite } from "./pull-files"
import type { PullFile } from "./pull-files"

const file = (filename: string): PullFile => ({
  filename,
  previousFilename: null,
  status: "modified",
  additions: 1,
  deletions: 0,
  patch: "@@ -1 +1 @@",
  url: "",
  viewed: "UNVIEWED",
})

describe("filesChangedSinceRewrite", () => {
  it("keeps the PR's files that changed, not what the rebase brought in", () => {
    const pull = [file("api/order.ts"), file("api/claim.ts")]
    // Compared across a rebase: the base branch's own files come along.
    const compared = new Set(["api/claim.ts", "web/page.tsx", "shared/db.ts"])
    expect(
      filesChangedSinceRewrite(pull, compared).map((f) => f.filename)
    ).toEqual(["api/claim.ts"])
  })
})
