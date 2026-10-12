import type { Octokit } from "octokit"

export type MergeMethod = "SQUASH" | "MERGE" | "REBASE"

export type MergeInfo = {
  methods: MergeMethod[]
  defaultMethod: MergeMethod
  /** CLEAN, UNSTABLE, BLOCKED, BEHIND, DIRTY, DRAFT, HAS_HOOKS or UNKNOWN. */
  mergeStateStatus: string
  canMerge: boolean
  /** Why the merge button is off, in the interface's words. */
  blockedReason: string | null
  headRef: string
  /** GitHub deletes the branch itself after the merge. */
  autoDeletesBranch: boolean
  /** The head branch lives in a fork, which the viewer cannot delete. */
  isCrossRepository: boolean
  title: string
}

type Ref = { owner: string; repo: string; number: number }

const BLOCKED_REASON: Record<string, string> = {
  BLOCKED:
    "Bloquée par les règles de la branche : review ou checks obligatoires manquants.",
  BEHIND: "La branche est en retard sur la base : mets-la à jour d'abord.",
  DIRTY: "Conflits avec la branche de base : à résoudre avant de merger.",
  DRAFT: "La PR est en brouillon.",
  UNKNOWN:
    "GitHub calcule encore si la PR peut être mergée : réessaie dans un instant.",
}

/** Merge states where GitHub accepts a merge; UNSTABLE only has non-required checks failing. */
const MERGEABLE_STATES = new Set(["CLEAN", "UNSTABLE", "HAS_HOOKS"])

export function toMergeInfo(raw: {
  squashMergeAllowed: boolean
  mergeCommitAllowed: boolean
  rebaseMergeAllowed: boolean
  deleteBranchOnMerge: boolean
  viewerDefaultMergeMethod: MergeMethod
  pullRequest: {
    title: string
    mergeStateStatus: string
    headRefName: string
    isCrossRepository: boolean
  }
}): MergeInfo {
  const methods: MergeMethod[] = [
    ...(raw.squashMergeAllowed ? (["SQUASH"] as const) : []),
    ...(raw.mergeCommitAllowed ? (["MERGE"] as const) : []),
    ...(raw.rebaseMergeAllowed ? (["REBASE"] as const) : []),
  ]
  const status = raw.pullRequest.mergeStateStatus
  const canMerge = MERGEABLE_STATES.has(status) && methods.length > 0
  return {
    methods,
    defaultMethod: methods.includes(raw.viewerDefaultMergeMethod)
      ? raw.viewerDefaultMergeMethod
      : (methods[0] ?? "MERGE"),
    mergeStateStatus: status,
    canMerge,
    blockedReason: canMerge
      ? null
      : methods.length === 0
        ? "Aucune méthode de merge n'est autorisée sur ce repo."
        : (BLOCKED_REASON[status] ?? `État de merge : ${status}.`),
    headRef: raw.pullRequest.headRefName,
    autoDeletesBranch: raw.deleteBranchOnMerge,
    isCrossRepository: raw.pullRequest.isCrossRepository,
    title: raw.pullRequest.title,
  }
}

export async function fetchMergeInfo(
  octokit: Octokit,
  ref: Ref
): Promise<MergeInfo> {
  const data: { repository: Parameters<typeof toMergeInfo>[0] } =
    await octokit.graphql(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          squashMergeAllowed mergeCommitAllowed rebaseMergeAllowed deleteBranchOnMerge
          viewerDefaultMergeMethod
          pullRequest(number: $number) { title mergeStateStatus headRefName isCrossRepository }
        }
      }`,
      { owner: ref.owner, repo: ref.repo, number: ref.number }
    )
  return toMergeInfo(data.repository)
}

export async function mergePull(
  octokit: Octokit,
  ref: Ref,
  options: { method: MergeMethod; deleteBranch: boolean }
): Promise<{ deletedBranch: string | null }> {
  const info = await fetchMergeInfo(octokit, ref)
  if (!info.canMerge) throw new Error(info.blockedReason ?? "Merge impossible.")
  await octokit.rest.pulls.merge({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.number,
    merge_method: options.method.toLowerCase() as "squash" | "merge" | "rebase",
  })
  if (!options.deleteBranch || info.autoDeletesBranch || info.isCrossRepository)
    return { deletedBranch: null }
  await octokit.rest.git.deleteRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${info.headRef}`,
  })
  return { deletedBranch: info.headRef }
}
