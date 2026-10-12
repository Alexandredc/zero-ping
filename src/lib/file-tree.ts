export type TreeFile<T> = { kind: "file"; name: string; path: string; file: T }
export type TreeFolder<T> = {
  kind: "folder"
  name: string
  path: string
  children: TreeNode<T>[]
}
export type TreeNode<T> = TreeFile<T> | TreeFolder<T>

/**
 * Builds a folder tree from file paths. Folders come first, then files, both
 * sorted by name; chains of single-folder directories are merged into one
 * node (`apps/webapp/app`) like GitHub does.
 */
export function buildFileTree<T>(
  files: T[],
  pathOf: (file: T) => string
): TreeNode<T>[] {
  const root: TreeFolder<T> = {
    kind: "folder",
    name: "",
    path: "",
    children: [],
  }
  for (const file of files) {
    const parts = pathOf(file).split("/")
    let folder = root
    parts.slice(0, -1).forEach((part, index) => {
      const path = parts.slice(0, index + 1).join("/")
      let next = folder.children.find(
        (child): child is TreeFolder<T> =>
          child.kind === "folder" && child.name === part
      )
      if (!next) {
        next = { kind: "folder", name: part, path, children: [] }
        folder.children.push(next)
      }
      folder = next
    })
    folder.children.push({
      kind: "file",
      name: parts.at(-1) ?? "",
      path: pathOf(file),
      file,
    })
  }
  return root.children.map(compact).sort(byKindThenName)
}

function byKindThenName<T>(a: TreeNode<T>, b: TreeNode<T>): number {
  if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
  return a.name.localeCompare(b.name)
}

function compact<T>(node: TreeNode<T>): TreeNode<T> {
  if (node.kind === "file") return node
  let current = node
  while (
    current.children.length === 1 &&
    current.children[0].kind === "folder"
  ) {
    const only = current.children[0]
    current = { ...only, name: `${current.name}/${only.name}` }
  }
  return {
    ...current,
    children: current.children.map(compact).sort(byKindThenName),
  }
}
