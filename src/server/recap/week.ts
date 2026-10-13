import type { Octokit } from "octokit"

export type WeekEntry = {
  key: string
  /** The title without its conventional-commit or `[US]` prefix. */
  label: string
  url: string
  repo: string
  number: number
  /** When it happened this week: merged, opened, reviewed or closed. */
  at: string
  author: string | null
  /** How many similar entries this one stands for, once grouped. */
  count: number
}

export type WeekSummary = {
  since: string
  /** PRs merged this week. */
  shipped: WeekEntry[]
  /** PRs opened this week and still open. */
  started: WeekEntry[]
  /** Other people's PRs the viewer reviewed this week. */
  reviewed: WeekEntry[]
  /** Issues assigned to the viewer and closed this week. */
  closed: WeekEntry[]
}

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

/** Monday 00:00, local time, of the week holding `now`. */
export function weekStart(now: Date = new Date()): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

/** `feat(webapp)!: add export` → `Add export`; `[US] Peak season` → `Peak season`. */
export function shortLabel(title: string): string {
  const label = title
    .replace(/^\s*[a-z]+(\([^)]*\))?!?:\s*/i, "")
    .replace(/^(\s*\[[^\]]+\]\s*[-–—:]?\s*)+/, "")
    .trim()
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : title
}

/** Release trains and version bumps say nothing about the week's work. */
export function isReleaseTitle(title: string): boolean {
  return (
    /^\s*chore(\([^)]*\))?!?:\s*(release|bump)/i.test(title) ||
    /^\s*(release|hotfix release|version bump)\b/i.test(title) ||
    // Branch promotions named after their branch, such as « Development ».
    /^\s*(development|develop|dev|main|master|staging)\s*$/i.test(title)
  )
}

type RawNode = {
  number?: number
  title?: string
  url?: string
  repository?: { nameWithOwner: string }
  mergedAt?: string | null
  createdAt?: string
  closedAt?: string | null
  author?: { login: string } | null
  reviews?: { nodes: { submittedAt: string | null }[] }
}

export function toEntries(
  nodes: RawNode[],
  at: (node: RawNode) => string | null | undefined
): WeekEntry[] {
  return nodes
    .filter(
      (
        node
      ): node is Required<
        Pick<RawNode, "number" | "title" | "url" | "repository">
      > &
        RawNode =>
        typeof node.number === "number" &&
        typeof node.title === "string" &&
        !isReleaseTitle(node.title)
    )
    .map((node) => ({
      key: `${node.repository.nameWithOwner}#${node.number}`,
      label: shortLabel(node.title),
      url: node.url,
      repo: node.repository.nameWithOwner,
      number: node.number,
      at: at(node) ?? node.createdAt ?? new Date().toISOString(),
      author: node.author?.login ?? null,
      count: 1,
    }))
    .sort((a, b) => a.at.localeCompare(b.at))
}

const FIELDS = `
  ... on PullRequest { number title url createdAt mergedAt author { login } repository { nameWithOwner } }
  ... on Issue { number title url createdAt closedAt author { login } repository { nameWithOwner } }
`

/** Only the owners of the tracked repos: side projects stay out of the daily. */
export async function fetchWeekSummary(
  octokit: Octokit,
  viewerLogin: string,
  owners: string[],
  now: Date = new Date()
): Promise<WeekSummary> {
  const since = weekStart(now)
  const day = localDay(since)
  const scope = owners.map((owner) => `user:${owner}`).join(" ")
  const search = (query: string, extra = "") =>
    `search(type: ISSUE, first: 50, query: ${JSON.stringify(`${query} ${scope}`.trim())}) { nodes { ${FIELDS} ${extra} } }`
  const data = await octokit.graphql<Record<string, { nodes: RawNode[] }>>(
    `query {
      shipped: ${search(`is:pr author:${viewerLogin} merged:>=${day}`)}
      started: ${search(`is:pr is:open author:${viewerLogin} created:>=${day}`)}
      reviewed: ${search(
        `is:pr reviewed-by:${viewerLogin} -author:${viewerLogin} updated:>=${day}`,
        `... on PullRequest { reviews(author: ${JSON.stringify(viewerLogin)}, last: 1) { nodes { submittedAt } } }`
      )}
      closed: ${search(`is:issue assignee:${viewerLogin} closed:>=${day}`)}
    }`
  )
  const reviewedAt = (node: RawNode) => node.reviews?.nodes.at(-1)?.submittedAt
  return {
    since: since.toISOString(),
    shipped: toEntries(data.shipped.nodes, (node) => node.mergedAt),
    started: toEntries(data.started.nodes, (node) => node.createdAt),
    // `updated:` also catches PRs touched after an older review.
    reviewed: toEntries(data.reviewed.nodes, reviewedAt).filter(
      (entry) => entry.at >= since.toISOString()
    ),
    closed: groupSimilar(toEntries(data.closed.nodes, (node) => node.closedAt)),
  }
}

/** A title with its commit hashes and numbers blanked, to spot generated tickets. */
export function titleTemplate(label: string): string {
  return label.replace(/\b[0-9a-f]{7,40}\b/gi, "…").replace(/\b\d+\b/g, "…")
}

/**
 * Folds tickets that only differ by a hash or a number (« Apply 5b33f43 to
 * GCP? » seven times) into one line that says how many there were.
 */
export function groupSimilar(entries: WeekEntry[]): WeekEntry[] {
  const groups = new Map<string, WeekEntry[]>()
  for (const entry of entries) {
    const template = titleTemplate(entry.label)
    groups.set(template, [...(groups.get(template) ?? []), entry])
  }
  return [...groups].map(([template, group]) =>
    group.length === 1
      ? group[0]
      : {
          ...group[group.length - 1],
          label: template,
          count: group.length,
        }
  )
}

/** Short enough to read aloud in a daily. */
export function clip(label: string, max = 70): string {
  return label.length > max ? `${label.slice(0, max - 1).trimEnd()}…` : label
}

/** The summary as plain bullets, ready to paste in a meeting chat. */
export function weekSummaryText(summary: WeekSummary): string {
  const line = (entry: WeekEntry) =>
    entry.count > 1
      ? `• ${clip(entry.label)} ×${entry.count}`
      : `• ${clip(entry.label)} (#${entry.number})`
  const review = (entry: WeekEntry) =>
    `• ${clip(entry.label)}${entry.author ? ` (@${entry.author})` : ""}`
  return [
    { title: "Livré", entries: summary.shipped, line },
    { title: "Lancé", entries: summary.started, line },
    { title: "Fermé", entries: summary.closed, line },
    { title: "Reviewé", entries: summary.reviewed, line: review },
  ]
    .filter((block) => block.entries.length > 0)
    .map((block) =>
      [`${block.title} :`, ...block.entries.map(block.line)].join("\n")
    )
    .join("\n\n")
}
