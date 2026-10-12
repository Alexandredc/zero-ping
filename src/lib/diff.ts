export type DiffLine =
  | { kind: "hunk"; text: string }
  | {
      kind: "add" | "del" | "context"
      text: string
      oldLine: number | null
      newLine: number | null
    }

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/

/** Splits a GitHub file patch into lines numbered on both sides. */
export function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = []
  let oldLine = 0
  let newLine = 0
  for (const raw of patch.split("\n")) {
    const hunk = raw.match(HUNK)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      lines.push({ kind: "hunk", text: raw })
    } else if (raw.startsWith("+")) {
      lines.push({
        kind: "add",
        text: raw.slice(1),
        oldLine: null,
        newLine: newLine++,
      })
    } else if (raw.startsWith("-")) {
      lines.push({
        kind: "del",
        text: raw.slice(1),
        oldLine: oldLine++,
        newLine: null,
      })
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file" carries no content.
      continue
    } else {
      lines.push({
        kind: "context",
        text: raw.startsWith(" ") ? raw.slice(1) : raw,
        oldLine: oldLine++,
        newLine: newLine++,
      })
    }
  }
  return lines
}
