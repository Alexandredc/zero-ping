import type { Octokit } from "octokit"
import type { Item } from "@/server/db/schema"
import type { InboxItem } from "@/server/inbox/actions"
import { subjectToItem } from "./as-item"

export type RawTeamIssue = {
  number: number
  title: string
  url: string
  updatedAt: string
  author: { login: string } | null
  labels: { nodes: { name: string }[] }
}

export const ISSUES_PER_PAGE = 100
/** Past this many open issues, a repo's least recently updated ones stay out. */
const MAX_ISSUES_PER_REPO = 1000

const REPO_ISSUES_QUERY = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, first: ${ISSUES_PER_PAGE}, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { number title url updatedAt author { login } labels(first: 10) { nodes { name } } }
    }
  }
}`

type RepoIssuesPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  nodes: RawTeamIssue[]
}
type RepoIssuesData = { repository: { issues: RepoIssuesPage } | null }

/** The open issues of one repo, the most recently updated first, page by page. */
export async function fetchRepoIssues(
  octokit: Pick<Octokit, "graphql">,
  fullName: string,
  max: number = MAX_ISSUES_PER_REPO
): Promise<{ repo: string; issue: RawTeamIssue }[]> {
  const [owner, name] = fullName.split("/")
  const issues: RawTeamIssue[] = []
  let after: string | null = null
  do {
    let data: RepoIssuesData | null
    try {
      data = await octokit.graphql<RepoIssuesData>(REPO_ISSUES_QUERY, {
        owner,
        name,
        after,
      })
    } catch (error) {
      // A deleted repo or a lost access must not hide the others.
      const partial = (error as { data?: RepoIssuesData | null }).data
      if (partial?.repository !== null) throw error
      data = partial
    }
    const page: RepoIssuesPage | undefined = data.repository?.issues
    if (!page) break
    issues.push(...page.nodes)
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
  } while (after && issues.length < max)
  return issues.map((issue) => ({ repo: fullName, issue }))
}

/** A teammate's issue shaped like an inbox item, for « Toutes les issues ». */
export function teamIssueToItem(repo: string, issue: RawTeamIssue): Item {
  return {
    ...subjectToItem({
      key: `${repo}#${issue.number}`,
      kind: "Issue",
      title: issue.title,
      url: issue.url,
    }),
    author: issue.author?.login ?? null,
    labels: issue.labels.nodes.map((label) => label.name),
    updatedAt: new Date(issue.updatedAt),
  }
}

/**
 * « Toutes les issues »: the inbox's open issues as the inbox lists them, then
 * the other fetched ones, the most recently updated first.
 */
export function mergeIssues(
  known: Map<string, InboxItem>,
  fetched: Item[],
  repo?: string
): InboxItem[] {
  const all = new Map(known)
  for (const item of fetched) {
    if (repo && item.repoFullName !== repo) continue
    if (!all.has(item.key))
      all.set(item.key, {
        ...item,
        slackDiscussions: null,
        inInbox: false,
        jevUrgency: null,
      })
  }
  return [...all.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  )
}

/** « Toutes les issues » loads this many issues at a time, the next ones on scroll. */
export const ISSUES_PAGE = 50

export type IssuePage = {
  items: InboxItem[]
  total: number
  /** Where the next page starts, or null after the last one. */
  nextOffset: number | null
}

export function pageOf(
  all: InboxItem[],
  { offset, limit }: { offset: number; limit: number }
): IssuePage {
  const end = offset + limit
  return {
    items: all.slice(offset, end),
    total: all.length,
    nextOffset: end < all.length ? end : null,
  }
}
