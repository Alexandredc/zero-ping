import type { Item, TeamPull } from "@/server/db/schema"

/**
 * A teammate's PR shaped like an inbox item, so that the detail panel can show
 * it although no notification brought it into the inbox.
 */
export function teamPullToItem(pull: TeamPull, viewerLogin?: string): Item {
  return {
    key: pull.key,
    repoFullName: pull.repoFullName,
    number: pull.number,
    kind: "PullRequest",
    subjectType: "PullRequest",
    title: pull.title,
    htmlUrl: pull.htmlUrl,
    threadId: null,
    reason: "team",
    unread: false,
    // The viewer's own PR keeps its merge box and has no review to give.
    view:
      viewerLogin && pull.author?.toLowerCase() === viewerLogin.toLowerCase()
        ? "mine"
        : "other",
    updatedAt: pull.updatedAt,
    state: "OPEN",
    isDraft: pull.isDraft,
    author: pull.author,
    labels: [],
    additions: pull.additions,
    deletions: pull.deletions,
    changedFiles: null,
    ciState: pull.ciState,
    reviewDecision: pull.reviewDecision,
    reviewRequest: null,
    reviewTeams: [],
    reviewIgnoredAt: null,
    approvals: 0,
    pendingReviewers: pull.reviewers.length,
    requestedAt: null,
    headOid: null,
    reviewedOid: null,
    reviewedAt: null,
    reviewedState: null,
    mergeStateStatus: null,
    readiness: pull.readiness,
    awaitingMe: false,
    awaitingUrl: null,
    awaitingExcerpt: null,
    awaitingFrom: null,
    awaitingSince: null,
    aiUrgency: null,
    aiConfidence: null,
    aiQuestionProbability: null,
    aiHash: null,
    priority: 0,
    priorityReasons: [],
    needsCheck: false,
    enrichedAt: null,
    doneAt: null,
    autoDoneReason: null,
    snoozedUntil: null,
  }
}

/**
 * An issue or PR known only by its GitHub facts, for the features that need an
 * item outside the inbox, such as the Slack search of « Mes issues ».
 */
export function subjectToItem(subject: {
  key: string
  kind: "PullRequest" | "Issue"
  title: string
  url: string
}): Item {
  const [repoFullName, number] = subject.key.split("#")
  return {
    ...teamPullToItem({
      key: subject.key,
      repoFullName,
      number: Number(number),
      title: subject.title,
      htmlUrl: subject.url,
      author: null,
      isDraft: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      additions: 0,
      deletions: 0,
      reviewers: [],
      reviewDecision: null,
      ciState: null,
      mergeable: null,
      problems: [],
      readiness: null,
      syncedAt: new Date(),
    }),
    kind: subject.kind,
    subjectType: subject.kind,
    additions: null,
    deletions: null,
  }
}
