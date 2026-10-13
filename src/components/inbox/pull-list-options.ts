import { pullSize } from "@/lib/format"
import { byDate } from "@/lib/list-filters"
import { sortOptions } from "@/lib/sorts"
import type { FilterDef } from "@/lib/list-filters"
import type { InboxItem } from "@/server/inbox/actions"

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

const URGENCY = ["Peut attendre", "Normale", "Importante", "Bloquante"]

export const PULL_FILTERS: FilterDef<InboxItem>[] = [
  {
    id: "kind",
    label: "Type",
    valuesOf: (item) => [item.kind],
    options: [
      { value: "PullRequest", label: "PR" },
      { value: "Issue", label: "Issue" },
    ],
  },
  {
    id: "review",
    label: "Review",
    valuesOf: (item) => (item.reviewDecision ? [item.reviewDecision] : []),
    options: [
      { value: "REVIEW_REQUIRED", label: "Review requise" },
      { value: "CHANGES_REQUESTED", label: "Changements demandés" },
      { value: "APPROVED", label: "Approuvée" },
    ],
  },
  {
    id: "ci",
    label: "CI",
    valuesOf: (item) =>
      item.ciState && CI[item.ciState] ? [CI[item.ciState]] : [],
    options: [
      { value: "failed", label: "CI en échec" },
      { value: "pending", label: "CI en cours" },
      { value: "passed", label: "CI passée" },
    ],
  },
  {
    id: "draft",
    label: "État",
    valuesOf: (item) =>
      item.kind === "PullRequest" ? [item.isDraft ? "draft" : "ready"] : [],
    options: [
      { value: "ready", label: "Prête pour review" },
      { value: "draft", label: "Brouillon" },
    ],
  },
  {
    id: "size",
    label: "Taille",
    valuesOf: (item) =>
      item.additions === null ? [] : [pullSize(item.additions, item.deletions)],
    options: ["XS", "S", "M", "L", "XL"].map((size) => ({
      value: size,
      label: `Taille ${size}`,
    })),
  },
  {
    id: "jev",
    label: "Urgence Jev",
    valuesOf: (item) =>
      item.jevUrgency === null ? [] : [String(item.jevUrgency)],
    options: [3, 2, 1, 0].map((level) => ({
      value: String(level),
      label: URGENCY[level],
    })),
  },
  {
    id: "author",
    label: "Auteur",
    valuesOf: (item) => (item.author ? [item.author] : []),
  },
  {
    id: "repo",
    label: "Repo",
    valuesOf: (item) => [item.repoFullName.split("/")[1]],
  },
  {
    id: "label",
    label: "Label",
    valuesOf: (item) => item.labels,
  },
]
