import type { Octokit } from "octokit"

export const UAT_BRANCH = "uat"

/** Commits read from the tip of uat; older deploys are out of reach. */
const MAX_UAT_COMMITS = 300

export type UatCommit = {
  oid: string
  headline: string
  committedDate: string
}

/** What uat holds for one commit subject, after its deploys and reverts. */
export type UatEntry = {
  deployed: boolean
  /** The latest uat commit about the subject: the deploy or the revert. */
  oid: string
  at: string
}

export type PullCommit = {
  headline: string
  committedDate: string
  isMerge: boolean
}

export type UatStatus =
  | { state: "merged" }
  | {
      state: "deployed" | "partial" | "reverted" | "absent"
      shipped: number
      total: number
      /** When the latest commit of the PR reached uat. */
      at: string | null
      /** Commits rewritten after their deploy: what uat runs is older. */
      outdated: string[]
      missing: string[]
    }

/** A subject as both sides spell it: a squash adds the PR number at the end. */
export function normalizeSubject(subject: string): string {
  return subject.trim().replace(/\s+\(#\d+\)$/, "")
}

/** `Revert "X"` undoes X; `Revert "Revert "X""` ships it again. */
function unwrapRevert(subject: string): { subject: string; reverts: number } {
  let reverts = 0
  let current = subject
  for (;;) {
    const match = /^Revert "(.*)"$/.exec(current)
    if (!match) return { subject: current, reverts }
    current = match[1]
    reverts += 1
  }
}

/**
 * Replays uat's history, oldest first: a cherry-pick keeps its subject even
 * when a conflict was fixed on the way, so the subject tells the work apart
 * where the sha cannot.
 */
export function uatLedger(newestFirst: UatCommit[]): Map<string, UatEntry> {
  const ledger = new Map<string, UatEntry>()
  for (const commit of newestFirst.toReversed()) {
    const { subject, reverts } = unwrapRevert(commit.headline)
    ledger.set(normalizeSubject(subject), {
      deployed: reverts % 2 === 0,
      oid: commit.oid,
      at: commit.committedDate,
    })
  }
  return ledger
}

/** Whether a PR's commits are on uat, and which ones are missing or stale. */
export function uatStatus(
  pull: { title: string; commits: PullCommit[] },
  ledger: Map<string, UatEntry>
): UatStatus {
  const commits = pull.commits.filter((commit) => !commit.isMerge)
  const entries = commits.map((commit) => ({
    commit,
    entry: ledger.get(normalizeSubject(commit.headline)),
  }))
  // Shipped from development after a squash, the PR is one commit named after it.
  const squashed = ledger.get(normalizeSubject(pull.title))
  if (!entries.some(({ entry }) => entry) && squashed)
    return {
      state: squashed.deployed ? "deployed" : "reverted",
      shipped: squashed.deployed ? commits.length : 0,
      total: commits.length,
      at: squashed.at,
      outdated: [],
      missing: [],
    }
  const shipped = entries.filter(({ entry }) => entry?.deployed)
  const reverted = entries.some(({ entry }) => entry && !entry.deployed)
  const state =
    shipped.length === 0
      ? reverted
        ? "reverted"
        : "absent"
      : shipped.length === entries.length
        ? "deployed"
        : "partial"
  return {
    state,
    shipped: shipped.length,
    total: entries.length,
    at:
      shipped
        .map(({ entry }) => entry?.at ?? "")
        .sort()
        .at(-1) ?? null,
    // The cherry-pick is dated at the deploy; a source rewritten later has moved on.
    outdated: shipped
      .filter(
        ({ commit, entry }) =>
          entry && Date.parse(commit.committedDate) > Date.parse(entry.at)
      )
      .map(({ commit }) => commit.headline),
    missing: entries
      .filter(({ entry }) => !entry?.deployed)
      .map(({ commit }) => commit.headline),
  }
}

/** The latest commits of uat, or null when the repo has no such branch. */
export async function fetchUatCommits(
  octokit: Octokit,
  repo: string
): Promise<UatCommit[] | null> {
  const [owner, name] = repo.split("/")
  const commits: UatCommit[] = []
  let after: string | null = null
  while (commits.length < MAX_UAT_COMMITS) {
    const data: {
      repository: {
        ref: {
          target: {
            history?: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null }
              nodes: UatCommit[]
            }
          }
        } | null
      } | null
    } = await octokit.graphql(
      `query ($owner: String!, $name: String!, $ref: String!, $after: String) {
        repository(owner: $owner, name: $name) {
          ref(qualifiedName: $ref) {
            target {
              ... on Commit {
                history(first: 100, after: $after) {
                  pageInfo { hasNextPage endCursor }
                  nodes { oid headline: messageHeadline committedDate }
                }
              }
            }
          }
        }
      }`,
      { owner, name, ref: `refs/heads/${UAT_BRANCH}`, after }
    )
    const history = data.repository?.ref?.target.history
    if (!history) return null
    commits.push(...history.nodes)
    if (!history.pageInfo.hasNextPage) break
    after = history.pageInfo.endCursor
  }
  return commits
}

export async function fetchPullForUat(
  octokit: Octokit,
  ref: { owner: string; repo: string; number: number }
) {
  const data = await octokit.graphql<{
    repository: {
      pullRequest: {
        title: string
        mergeCommit: { oid: string } | null
        commits: {
          nodes: {
            commit: {
              messageHeadline: string
              committedDate: string
              parents: { totalCount: number }
            }
          }[]
        }
      } | null
    } | null
  }>(
    `query ($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          title
          mergeCommit { oid }
          commits(last: 100) {
            nodes { commit { messageHeadline committedDate parents { totalCount } } }
          }
        }
      }
    }`,
    ref
  )
  const pull = data.repository?.pullRequest
  if (!pull) return null
  return {
    title: pull.title,
    mergeCommit: pull.mergeCommit?.oid ?? null,
    commits: pull.commits.nodes.map(({ commit }) => ({
      headline: commit.messageHeadline,
      committedDate: commit.committedDate,
      isMerge: commit.parents.totalCount > 1,
    })),
  }
}

/** Whether a commit is in uat's ancestry, as after uat is reset onto development. */
export async function isOnUat(
  octokit: Octokit,
  ref: { owner: string; repo: string },
  sha: string
): Promise<boolean> {
  try {
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
      ...ref,
      basehead: `${UAT_BRANCH}...${sha}`,
      per_page: 1,
    })
    return data.status === "identical" || data.status === "behind"
  } catch {
    return false
  }
}
