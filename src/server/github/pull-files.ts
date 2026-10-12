import type { Octokit } from "octokit"

export type PullFile = {
  filename: string
  previousFilename: string | null
  status: string
  additions: number
  deletions: number
  /** Unified diff of the file; absent for binary or very large files. */
  patch: string | null
  url: string
  /** VIEWED, UNVIEWED, or DISMISSED when the file changed after being viewed. */
  viewed: ViewedState
}

export type ViewedState = "VIEWED" | "UNVIEWED" | "DISMISSED"

export type PullFiles = {
  /** GraphQL id of the pull request, needed to mark files as viewed. */
  pullRequestId: string
  files: PullFile[]
  /** GitHub lists at most 3000 files; the app stops earlier. */
  truncated: boolean
  totalAdditions: number
  totalDeletions: number
  /** Set when the diff only covers the commits pushed since the viewer's review. */
  sinceReview: { base: string; head: string; commits: number } | null
}

const MAX_FILES = 300

/** The REST file list has no viewed state: it comes from GraphQL, 100 files a page. */
async function fetchViewedStates(
  octokit: Octokit,
  ref: { owner: string; repo: string; number: number }
): Promise<{ pullRequestId: string; states: Map<string, ViewedState> }> {
  const states = new Map<string, ViewedState>()
  let pullRequestId = ""
  let cursor: string | null = null
  for (let page = 0; page < MAX_FILES / 100; page++) {
    const data: {
      repository: {
        pullRequest: {
          id: string
          files: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null }
            nodes: { path: string; viewerViewedState: ViewedState }[]
          }
        }
      }
    } = await octokit.graphql(
      `query ($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            id
            files(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes { path viewerViewedState }
            }
          }
        }
      }`,
      { owner: ref.owner, repo: ref.repo, number: ref.number, cursor }
    )
    const pull = data.repository.pullRequest
    pullRequestId = pull.id
    for (const node of pull.files.nodes)
      states.set(node.path, node.viewerViewedState)
    if (!pull.files.pageInfo.hasNextPage) break
    cursor = pull.files.pageInfo.endCursor
  }
  return { pullRequestId, states }
}

/** Marks or unmarks a file as viewed on GitHub, as the "Viewed" checkbox does. */
export async function setFileViewed(
  octokit: Octokit,
  pullRequestId: string,
  path: string,
  viewed: boolean
): Promise<void> {
  const mutation = viewed ? "markFileAsViewed" : "unmarkFileAsViewed"
  await octokit.graphql(
    `mutation ($pullRequestId: ID!, $path: String!) {
      ${mutation}(input: { pullRequestId: $pullRequestId, path: $path }) { clientMutationId }
    }`,
    { pullRequestId, path }
  )
}

type RestFile = {
  filename: string
  previous_filename?: string
  status: string
  additions: number
  deletions: number
  patch?: string
  sha: string | null
}

function toPullFile(
  ref: { owner: string; repo: string; number: number },
  file: RestFile
): PullFile {
  return {
    filename: file.filename,
    previousFilename: file.previous_filename ?? null,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
    url: `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}/files#diff-${file.sha}`,
    viewed: "UNVIEWED",
  }
}

/**
 * Lists the changed files, or with `since` only what changed between the
 * reviewed commit and the head. After a force-push the comparison also shows
 * the base changes brought by the rebase.
 */
export async function fetchPullFiles(
  octokit: Octokit,
  ref: { owner: string; repo: string; number: number },
  since?: { base: string; head: string }
): Promise<PullFiles> {
  if (since) {
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner: ref.owner,
      repo: ref.repo,
      basehead: `${since.base}...${since.head}`,
      per_page: 100,
    })
    const compared = (data.files ?? []).slice(0, MAX_FILES)
    const files = compared.map((file) => toPullFile(ref, file))
    const { pullRequestId, states } = await fetchViewedStates(octokit, ref)
    for (const file of files)
      file.viewed = states.get(file.filename) ?? "UNVIEWED"
    return {
      pullRequestId,
      files,
      truncated: (data.files?.length ?? 0) > MAX_FILES,
      totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
      totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
      sinceReview: { ...since, commits: data.ahead_by },
    }
  }
  const files: PullFile[] = []
  let truncated = false
  for await (const { data } of octokit.paginate.iterator(
    octokit.rest.pulls.listFiles,
    {
      owner: ref.owner,
      repo: ref.repo,
      pull_number: ref.number,
      per_page: 100,
    }
  )) {
    for (const file of data) {
      if (files.length >= MAX_FILES) {
        truncated = true
        break
      }
      files.push(toPullFile(ref, file))
    }
    if (truncated) break
  }
  const { pullRequestId, states } = await fetchViewedStates(octokit, ref)
  for (const file of files)
    file.viewed = states.get(file.filename) ?? "UNVIEWED"
  return {
    pullRequestId,
    files,
    truncated,
    totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
    totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
    sinceReview: null,
  }
}
