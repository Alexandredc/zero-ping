import type { View } from "@/server/db/schema"

export type Comment = {
  id: string
  databaseId: number | null
  author: string | null
  body: string
  createdAt: string
  url: string
}

export type ReviewThread = {
  isResolved: boolean
  comments: Comment[]
}

export type Review = {
  author: string | null
  state: string
  submittedAt: string
  commitOid: string | null
}

export type ReviewRequest = { user: string } | { team: string }

export type SubjectDetails = {
  kind: "PullRequest" | "Issue"
  title: string
  url: string
  body: string
  createdAt: string
  state: string
  isDraft: boolean
  author: string | null
  labels: string[]
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  headOid: string | null
  reviews: Review[]
  ciState: string | null
  reviewDecision: string | null
  reviewRequests: ReviewRequest[]
  reviewRequestedAt: { reviewer: ReviewRequest; createdAt: string }[]
  approvals: number
  comments: Comment[]
  reviewThreads: ReviewThread[]
}

export type Viewer = {
  login: string
  /** Team handles as `org/slug`. */
  teams: string[]
}

export type Awaiting = {
  url: string
  excerpt: string
  from: string | null
  since: Date
}

/** The viewer's latest review, and whether commits were pushed after it. */
export type LastReview = {
  oid: string | null
  at: Date
  state: string
  newCommits: boolean
}

export type Analysis = {
  view: View
  reviewRequest: "direct" | "team" | null
  requestedAt: Date | null
  awaiting: Awaiting | null
  lastReview: LastReview | null
}

const sameLogin = (a: string | null, b: string) =>
  a !== null && a.toLowerCase() === b.toLowerCase()

function mentions(body: string, handles: string[]): boolean {
  return handles.some((handle) => {
    const escaped = handle.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
    return new RegExp(`(^|[^\\w/])@${escaped}(?![\\w/-])`, "i").test(body)
  })
}

function excerpt(body: string): string {
  const text = body.replace(/\s+/g, " ").trim()
  return text.length > 280 ? `${text.slice(0, 277)}…` : text
}

/**
 * Finds what the viewer has not answered yet: mentions anywhere, and in
 * unresolved review threads every reply that follows the viewer's last comment
 * when they took part in the thread or own the PR.
 */
export function findAwaiting(
  details: SubjectDetails,
  viewer: Viewer
): Awaiting | null {
  const handles = [viewer.login, ...viewer.teams]
  const isViewer = (c: Comment) => sameLogin(c.author, viewer.login)

  /** Messages from others after the viewer's last one: all of them, or only mentions. */
  const unanswered = (conversation: Comment[], followReplies: boolean) => {
    const sorted = [...conversation].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
    const lastOwnIndex = sorted.findLastIndex(isViewer)
    const follow = followReplies && (lastOwnIndex >= 0 || viewerIsAuthor)
    return sorted
      .slice(lastOwnIndex + 1)
      .filter((c) => !isViewer(c) && (follow || mentions(c.body, handles)))
  }

  const viewerIsAuthor = sameLogin(details.author, viewer.login)
  const description: Comment = {
    id: "description",
    databaseId: null,
    author: details.author,
    body: details.body,
    createdAt: details.createdAt,
    url: details.url,
  }
  const pending = [
    // In the main conversation only mentions count: replies there are often for someone else.
    ...unanswered([description, ...details.comments], false),
    ...details.reviewThreads
      .filter((thread) => !thread.isResolved)
      .flatMap((thread) => unanswered(thread.comments, true)),
  ]

  if (pending.length === 0) return null
  pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const oldest = pending[0]
  const latest = pending[pending.length - 1]
  return {
    url: latest.url,
    excerpt: excerpt(latest.body),
    from: latest.author,
    since: new Date(oldest.createdAt),
  }
}

/**
 * The viewer's latest review sets the commit they last read. Its verdict comes
 * from their latest approval or change request: a reply in a review thread is
 * also a COMMENTED review, and must not hide a change request.
 */
export function findLastReview(
  details: SubjectDetails,
  viewer: Viewer
): LastReview | null {
  const own = details.reviews
    .filter((review) => sameLogin(review.author, viewer.login))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const latest = own.at(-1)
  if (!latest) return null
  const verdict = own.findLast(
    (review) =>
      review.state === "APPROVED" || review.state === "CHANGES_REQUESTED"
  )
  return {
    oid: latest.commitOid,
    at: new Date(latest.submittedAt),
    state: verdict?.state ?? latest.state,
    newCommits:
      latest.commitOid !== null &&
      details.headOid !== null &&
      latest.commitOid !== details.headOid,
  }
}

export function analyze(details: SubjectDetails, viewer: Viewer): Analysis {
  const isReviewer = (request: ReviewRequest): "direct" | "team" | null => {
    if ("user" in request)
      return sameLogin(request.user, viewer.login) ? "direct" : null
    return viewer.teams.some(
      (team) => team.toLowerCase() === request.team.toLowerCase()
    )
      ? "team"
      : null
  }

  let reviewRequest: "direct" | "team" | null = null
  if (details.kind === "PullRequest" && details.state === "OPEN") {
    const kinds = details.reviewRequests.map(isReviewer)
    reviewRequest = kinds.includes("direct")
      ? "direct"
      : kinds.includes("team")
        ? "team"
        : null
  }

  const requestedAt =
    details.reviewRequestedAt
      .filter((event) => isReviewer(event.reviewer) !== null)
      .map((event) => new Date(event.createdAt))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null

  const awaiting =
    details.state === "OPEN" ? findAwaiting(details, viewer) : null

  const isAuthor = sameLogin(details.author, viewer.login)
  const lastReview =
    details.kind === "PullRequest" && !isAuthor
      ? findLastReview(details, viewer)
      : null
  // Commits pushed after the viewer asked for changes usually answer them.
  const changesAddressed =
    details.state === "OPEN" &&
    !details.isDraft &&
    lastReview?.state === "CHANGES_REQUESTED" &&
    lastReview.newCommits

  let view: View = "other"
  if (reviewRequest || changesAddressed) view = "review"
  else if (awaiting) view = "awaiting"
  else if (isAuthor && details.state === "OPEN") view = "mine"

  return { view, reviewRequest, requestedAt, awaiting, lastReview }
}
