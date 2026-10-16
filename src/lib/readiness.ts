import type { Messages } from "@/lib/i18n/messages"
import type { Readiness, ReadinessGap } from "@/server/readiness/rules"

/** One gap in the interface's words: « à rebaser », « attend #10569 »… */
export function gapLabel(gap: ReadinessGap, t: Messages): string {
  const r = t.pull.readiness
  switch (gap.kind) {
    case "draft":
      return r.gaps.draft
    case "review":
      return gap.decision === "CHANGES_REQUESTED"
        ? r.gaps.changesRequested
        : r.gaps.notApproved
    case "commit-after-approval":
      return r.gaps.commitAfterApproval
    case "threads":
      return r.gaps.threads(gap.count)
    case "behind":
    case "blocked":
    case "unstable":
    case "dirty":
      return r.gaps[gap.kind]
    case "wait":
      return gap.reason === "dependency"
        ? r.wait.dependency(gap.pull)
        : r.wait[gap.reason]
  }
}

/** « Prête à merger », or « Presque : à rebaser, 2 fils ouverts ». */
export function readinessText(readiness: Readiness, t: Messages): string {
  const r = t.pull.readiness
  if (readiness.status === "ready") return r.ready
  if (readiness.status === "computing") return r.computing
  return `${r.almost} ${readiness.gaps.map((gap) => gapLabel(gap, t)).join(", ")}`
}
