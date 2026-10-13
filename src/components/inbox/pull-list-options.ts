import { pullSize } from "@/lib/format"
import { byDate } from "@/lib/list-filters"
import { sortOptions } from "@/lib/sorts"
import type { FilterDef } from "@/lib/list-filters"
import type { InboxItem } from "@/server/inbox/actions"
import type { Messages } from "@/lib/i18n/messages"

export const PULL_SORTS = [
  "priority",
  "size",
  "recent",
  "oldest",
  "waiting",
] as const
export type PullSort = (typeof PULL_SORTS)[number]

export const PULL_SORT_OPTIONS = sortOptions<PullSort>({
  priority: "priority",
  size: "size",
  recent: "recent",
  oldest: "oldest",
  waiting: "waiting",
})

/** The server ranks by priority or size; the other orders are the list's own. */
export function serverSort(sort: PullSort): "priority" | "size" {
  return sort === "size" ? "size" : "priority"
}

export function sortPulls(items: InboxItem[], sort: PullSort): InboxItem[] {
  if (sort === "recent")
    return [...items].sort(byDate((item) => item.updatedAt, "desc"))
  if (sort === "oldest")
    return [...items].sort(byDate((item) => item.updatedAt, "asc"))
  if (sort === "waiting")
    return [...items].sort(
      byDate((item) => item.requestedAt ?? item.awaitingSince, "asc")
    )
  return items
}

const CI: Record<string, string> = {
  SUCCESS: "passed",
  FAILURE: "failed",
  ERROR: "failed",
  PENDING: "pending",
  EXPECTED: "pending",
}

/** The filters of the PR lists, named in the chosen language. */
export function pullFilters(t: Messages): FilterDef<InboxItem>[] {
  const f = t.inbox.filters
  return [
    {
      id: "kind",
      label: f.kind,
      valuesOf: (item) => [item.kind],
      options: [
        { value: "PullRequest", label: "PR" },
        { value: "Issue", label: "Issue" },
      ],
    },
    {
      id: "review",
      label: f.review,
      valuesOf: (item) => (item.reviewDecision ? [item.reviewDecision] : []),
      options: [
        { value: "REVIEW_REQUIRED", label: f.reviewRequired },
        { value: "CHANGES_REQUESTED", label: f.changesRequested },
        { value: "APPROVED", label: f.approved },
      ],
    },
    {
      id: "ci",
      label: f.ci,
      valuesOf: (item) =>
        item.ciState && CI[item.ciState] ? [CI[item.ciState]] : [],
      options: [
        { value: "failed", label: f.ciFailed },
        { value: "pending", label: f.ciPending },
        { value: "passed", label: f.ciPassed },
      ],
    },
    {
      id: "draft",
      label: f.state,
      valuesOf: (item) =>
        item.kind === "PullRequest" ? [item.isDraft ? "draft" : "ready"] : [],
      options: [
        { value: "ready", label: f.ready },
        { value: "draft", label: f.draft },
      ],
    },
    {
      id: "size",
      label: f.size,
      valuesOf: (item) =>
        item.additions === null
          ? []
          : [pullSize(item.additions, item.deletions)],
      options: ["XS", "S", "M", "L", "XL"].map((size) => ({
        value: size,
        label: t.inbox.strip.size(size),
      })),
    },
    {
      id: "jev",
      label: f.jev,
      valuesOf: (item) =>
        item.jevUrgency === null ? [] : [String(item.jevUrgency)],
      options: [3, 2, 1, 0].map((level) => ({
        value: String(level),
        label: f.urgency[level],
      })),
    },
    {
      id: "author",
      label: f.author,
      valuesOf: (item) => (item.author ? [item.author] : []),
    },
    {
      id: "repo",
      label: f.repo,
      valuesOf: (item) => [item.repoFullName.split("/")[1]],
    },
    {
      id: "label",
      label: f.label,
      valuesOf: (item) => item.labels,
    },
  ]
}
