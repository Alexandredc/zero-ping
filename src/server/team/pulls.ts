import type { Octokit } from "octokit"
import type { Database } from "@/server/db/client"
import { teamPulls } from "@/server/db/schema"
import type { TeamProblem } from "@/server/db/schema"
import { isBot } from "@/server/inbox/auto-done"
import { TEAM_PREFIX } from "./labels"
import { scoreInBackground } from "@/server/ai/scores"
import type { ScoreSubject } from "@/server/ai/scores"

export type RawTeamPull = {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  isDraft: boolean
  additions: number
  deletions: number
  author: { login: string } | null
  reviewDecision: string | null
  mergeable: string
  reviewRequests: {
    nodes: {
      requestedReviewer: { login?: string; slug?: string } | null
    }[]
  }
  reviews: { totalCount: number }
  body: string
  labels: { nodes: { name: string }[] }
  comments: { nodes: { author: { login: string } | null; body: string }[] }
  commits: {
    nodes: { commit: { statusCheckRollup: { state: string } | null } }[]
  }
}

const PULL_FIELDS = `
  number title url createdAt updatedAt isDraft additions deletions mergeable reviewDecision
  author { login }
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { slug } } } }
  reviews(first: 1) { totalCount }
  body
  labels(first: 10) { nodes { name } }
  comments(last: 3) { nodes { author { login } body } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
`

const DAY_MS = 24 * 60 * 60 * 1000
/** Requested changes left without a push for this long block the PR. */
const CHANGES_IDLE_DAYS = 2
const REPOS_PER_QUERY = 4
const PULLS_PER_REPO = 50

/** What keeps a teammate's PR from moving, most blocking first. */
export function teamProblems(
  pull: RawTeamPull,
  now: Date,
  staleDays: number
): TeamProblem[] {
  if (pull.isDraft) return []
  const problems: TeamProblem[] = []
  const ci = pull.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null
  const idle = now.getTime() - new Date(pull.updatedAt).getTime()
  if (pull.reviewRequests.nodes.length === 0 && pull.reviews.totalCount === 0)
    problems.push("no-reviewer")
  if (
    pull.reviewDecision === "CHANGES_REQUESTED" &&
    idle > CHANGES_IDLE_DAYS * DAY_MS
  )
    problems.push("changes")
  if (ci === "FAILURE" || ci === "ERROR") problems.push("ci")
  if (pull.mergeable === "CONFLICTING") problems.push("conflict")
  if (now.getTime() - new Date(pull.createdAt).getTime() > staleDays * DAY_MS)
    problems.push("stale")
  return problems
}

export function toScoreSubject(repo: string, pull: RawTeamPull): ScoreSubject {
  return {
    key: `${repo}#${pull.number}`,
    kind: "PullRequest",
    title: pull.title,
    url: pull.url,
    body: pull.body,
    author: pull.author?.login ?? null,
    labels: pull.labels.nodes.map((label) => label.name),
    isDraft: pull.isDraft,
    additions: pull.additions,
    deletions: pull.deletions,
    ciState: pull.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    comments: pull.comments.nodes.map((comment) => ({
      author: comment.author?.login ?? null,
      body: comment.body,
    })),
  }
}

async function fetchRepoPulls(
  octokit: Octokit,
  fullNames: string[]
): Promise<{ repo: string; pull: RawTeamPull }[]> {
  const fields = fullNames
    .map((fullName, index) => {
      const [owner, name] = fullName.split("/")
      return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) {
        pullRequests(states: OPEN, first: ${PULLS_PER_REPO}, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes { ${PULL_FIELDS} }
        }
      }`
    })
    .join("\n")
  type Data = Record<string, { pullRequests: { nodes: RawTeamPull[] } } | null>
  let data: Data
  try {
    data = await octokit.graphql(`query { ${fields} }`)
  } catch (error) {
    // A deleted repo or a lost access must not hide the others.
    const partial = (error as { data?: Data }).data
    if (!partial) throw error
    data = partial
  }
  return fullNames.flatMap((repo, index) =>
    (data[`r${index}`]?.pullRequests.nodes ?? []).map((pull) => ({
      repo,
      pull,
    }))
  )
}

/** Replaces the team PRs of the given repos with their current state on GitHub. */
export async function syncTeamPulls(
  db: Database,
  octokit: Octokit,
  options: { repos: string[]; viewerLogin: string; staleDays: number }
): Promise<number> {
  const now = new Date()
  const batches: string[][] = []
  for (let start = 0; start < options.repos.length; start += REPOS_PER_QUERY)
    batches.push(options.repos.slice(start, start + REPOS_PER_QUERY))
  const fetched = (
    await Promise.all(batches.map((batch) => fetchRepoPulls(octokit, batch)))
  ).flat()

  const viewer = options.viewerLogin.toLowerCase()
  const rows = fetched
    .filter(({ pull }) => {
      const author = pull.author?.login ?? null
      return author?.toLowerCase() !== viewer && !isBot(author)
    })
    .map(({ repo, pull }) => ({
      key: `${repo}#${pull.number}`,
      repoFullName: repo,
      number: pull.number,
      title: pull.title,
      htmlUrl: pull.url,
      author: pull.author?.login ?? null,
      isDraft: pull.isDraft,
      createdAt: new Date(pull.createdAt),
      updatedAt: new Date(pull.updatedAt),
      additions: pull.additions,
      deletions: pull.deletions,
      // Teams are prefixed so that people and teams can be told apart.
      reviewers: pull.reviewRequests.nodes.flatMap(({ requestedReviewer }) => {
        if (requestedReviewer?.login) return [requestedReviewer.login]
        if (requestedReviewer?.slug)
          return [`${TEAM_PREFIX}${requestedReviewer.slug}`]
        return []
      }),
      reviewDecision: pull.reviewDecision,
      ciState: pull.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
      mergeable: pull.mergeable,
      problems: teamProblems(pull, now, options.staleDays),
      syncedAt: now,
    }))

  // Jev ranks « Toutes les PR »; the snapshot does not wait for it.
  scoreInBackground(
    db,
    fetched
      .filter(({ repo, pull }) =>
        rows.some((row) => row.key === `${repo}#${pull.number}`)
      )
      .map(({ repo, pull }) => toScoreSubject(repo, pull)),
    options.viewerLogin
  )

  await db.transaction(async (tx) => {
    // Repos no longer tracked keep nothing; tracked ones get a fresh snapshot.
    await tx.delete(teamPulls)
    if (rows.length > 0) await tx.insert(teamPulls).values(rows)
  })
  return rows.length
}
