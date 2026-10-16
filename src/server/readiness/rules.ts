/** What Jev can read as a reason to hold a PR back, see `wait.ts`. */
export const WAIT_REASONS = [
  "dependency",
  "hold",
  "freeze",
  "label",
  "question",
  "other",
] as const
export type WaitReason = (typeof WAIT_REASONS)[number]

/** One thing missing before a PR can be merged, most blocking first. */
export type ReadinessGap =
  | { kind: "draft" }
  | { kind: "review"; decision: string | null }
  | { kind: "commit-after-approval" }
  | { kind: "threads"; count: number }
  | { kind: "behind" }
  | { kind: "blocked" }
  | { kind: "unstable" }
  | { kind: "dirty" }
  | { kind: "wait"; reason: WaitReason; pull: number | null }

export type Readiness = {
  /**
   * `computing` while GitHub has not worked out the merge state yet: nothing
   * is missing, but the PR is not known to be ready either.
   */
  status: "ready" | "almost" | "computing"
  gaps: ReadinessGap[]
  /** Hash of what Jev read, so that an unchanged PR is not asked again. */
  waitHash: string | null
}

/** The GitHub facts the rules read, from the GraphQL pull request. */
export type ReadinessFacts = {
  isDraft: boolean
  reviewDecision: string | null
  /** CLEAN, BEHIND, BLOCKED, UNSTABLE, DIRTY, DRAFT, HAS_HOOKS or UNKNOWN. */
  mergeStateStatus: string | null
  /** Commit date of the head commit. */
  lastCommitAt: string | null
  reviews: { state: string; submittedAt: string }[]
  reviewThreads: { isResolved: boolean }[]
}

const MERGE_STATE_GAPS: Partial<Record<string, ReadinessGap>> = {
  BEHIND: { kind: "behind" },
  BLOCKED: { kind: "blocked" },
  UNSTABLE: { kind: "unstable" },
  DIRTY: { kind: "dirty" },
}

/** Merge states with nothing left to do; HAS_HOOKS only adds pre-receive hooks. */
const CLEAN_STATES = new Set(["CLEAN", "HAS_HOOKS"])

/** What the code rules find missing, before Jev is asked anything. */
export function readinessGaps(facts: ReadinessFacts): ReadinessGap[] {
  const gaps: ReadinessGap[] = []
  if (facts.isDraft) gaps.push({ kind: "draft" })
  const approved = facts.reviewDecision === "APPROVED"
  if (!approved) gaps.push({ kind: "review", decision: facts.reviewDecision })

  const lastApproval = facts.reviews
    .filter((review) => review.state === "APPROVED")
    .map((review) => new Date(review.submittedAt).getTime())
    .reduce((latest, at) => Math.max(latest, at), -Infinity)
  if (
    approved &&
    facts.lastCommitAt &&
    Number.isFinite(lastApproval) &&
    new Date(facts.lastCommitAt).getTime() > lastApproval
  )
    gaps.push({ kind: "commit-after-approval" })

  const open = facts.reviewThreads.filter((thread) => !thread.isResolved).length
  if (open > 0) gaps.push({ kind: "threads", count: open })

  const mergeGap = MERGE_STATE_GAPS[facts.mergeStateStatus ?? ""]
  // A missing approval or an open thread is what usually blocks the branch:
  // saying it twice would hide the real cause.
  const explained =
    mergeGap?.kind === "blocked" &&
    gaps.some((gap) => gap.kind === "review" || gap.kind === "threads")
  if (mergeGap && !explained) gaps.push(mergeGap)
  return gaps
}

/**
 * The rules' verdict: `almost` with the gaps, `computing` while the merge
 * state is unknown, `ready` once only Jev's opinion is left to ask.
 */
export function assessReadiness(facts: ReadinessFacts): Readiness {
  const gaps = readinessGaps(facts)
  if (gaps.length > 0) return { status: "almost", gaps, waitHash: null }
  if (!CLEAN_STATES.has(facts.mergeStateStatus ?? ""))
    return { status: "computing", gaps: [], waitHash: null }
  return { status: "ready", gaps: [], waitHash: null }
}

/** Adds Jev's « wait » to a PR the rules found ready. */
export function withWait(
  readiness: Readiness,
  wait: { gap: ReadinessGap | null; hash: string }
): Readiness {
  if (readiness.status !== "ready") return readiness
  return wait.gap
    ? { status: "almost", gaps: [wait.gap], waitHash: wait.hash }
    : { ...readiness, waitHash: wait.hash }
}

/** Only rules passed: the PR is what Jev is asked about. */
export const needsWaitCheck = (readiness: Readiness) =>
  readiness.status === "ready"
