import { describe, expect, it } from "vitest"
import { buildFileTree } from "./file-tree"
import type { TreeNode } from "./file-tree"

const names = (nodes: TreeNode<string>[]): unknown =>
  nodes.map((node) =>
    node.kind === "file" ? node.name : { [node.name]: names(node.children) }
  )

describe("buildFileTree", () => {
  it("nests files, lists folders first and merges single-folder chains", () => {
    const tree = buildFileTree(
      [
        "apps/webapp/app/filters/drawer.tsx",
        "apps/webapp/app/filters/chips.tsx",
        "apps/webapp/app/page.tsx",
        "README.md",
        "packages/ui/button.tsx",
      ],
      (path) => path
    )
    expect(names(tree)).toEqual([
      {
        "apps/webapp/app": [
          { filters: ["chips.tsx", "drawer.tsx"] },
          "page.tsx",
        ],
      },
      { "packages/ui": ["button.tsx"] },
      "README.md",
    ])
  })

  it("keeps each file's full path for navigation", () => {
    const [folder] = buildFileTree(["src/a.ts"], (path) => path)
    expect(folder).toMatchObject({ kind: "folder", name: "src", path: "src" })
    expect(folder.kind === "folder" && folder.children[0]).toMatchObject({
      kind: "file",
      name: "a.ts",
      path: "src/a.ts",
    })
  })
})
