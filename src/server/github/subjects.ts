import type { Octokit } from "octokit"
import type {
  Comment,
  ReviewRequest,
  SubjectDetails,
} from "@/server/inbox/analyze"

export type SubjectRef = {
  key: string
  owner: string
  repo: string
  number: number
  kind: "PullRequest" | "Issue"
}

const COMMENT_FIELDS = `id databaseId author { login } body createdAt url`

const REVIEWER_FIELDS = `
  ... on User { login }
  ... on Team { slug organization { login } }
`

const PULL_REQUEST_FIELDS = `
  title url body createdAt state isDraft additions deletions changedFiles
  reviewDecision headRefOid mergeStateStatus
  author { login }
  labels(first: 20) { nodes { name } }
  reviewRequests(first: 20) { nodes { requestedReviewer { ${REVIEWER_FIELDS} } } }
  latestOpinionatedReviews(first: 20) { nodes { state } }
  reviews(last: 30) { nodes { author { login } state submittedAt commit { oid } } }
  commits(last: 1) { nodes { commit { committedDate statusCheckRollup { state } } } }
  comments(last: 20) { nodes { ${COMMENT_FIELDS} } }
  reviewThreads(last: 50) {
    nodes { isResolved comments(last: 10) { nodes { ${COMMENT_FIELDS} } } }
  }
  timelineItems(last: 20, itemTypes: [REVIEW_REQUESTED_EVENT]) {
    nodes { ... on ReviewRequestedEvent { createdAt requestedReviewer { ${REVIEWER_FIELDS} } } }
  }
`

const ISSUE_FIELDS = `
  title url body createdAt state
  author { login }
  labels(first: 20) { nodes { name } }
  comments(last: 20) { nodes { ${COMMENT_FIELDS} } }
`

type RawComment = {
  id: string
  databaseId: number | null
  author: { login: string } | null
  body: string
  createdAt: string
  url: string
}

type RawReviewer = {
  login?: string
  slug?: string
  organization?: { login: string }
} | null

type RawSubject = {
  title: string
  url: string
  body: string
  createdAt: string
  state: string
  isDraft?: boolean
  additions?: number
  deletions?: number
  changedFiles?: number
  headRefOid?: string
  reviewDecision?: string | null
  mergeStateStatus?: string
  author: { login: string } | null
  labels: { nodes: { name: string }[] }
  reviewRequests?: { nodes: { requestedReviewer: RawReviewer }[] }
  latestOpinionatedReviews?: { nodes: { state: string }[] }
  reviews?: {
    nodes: {
      author: { login: string } | null
      state: string
      submittedAt: string | null
      commit: { oid: string } | null
    }[]
  }
  commits?: {
    nodes: {
      commit: {
        committedDate?: string
        statusCheckRollup: { state: string } | null
      }
    }[]
  }
  comments: { nodes: RawComment[] }
  reviewThreads?: {
    nodes: { isResolved: boolean; comments: { nodes: RawComment[] } }[]
  }
  timelineItems?: {
    nodes: { createdAt?: string; requestedReviewer?: RawReviewer }[]
  }
}

function toComment(raw: RawComment): Comment {
  return {
    id: raw.id,
    databaseId: raw.databaseId,
    author: raw.author?.login ?? null,
    body: raw.body,
    createdAt: raw.createdAt,
    url: raw.url,
  }
}

function toReviewRequest(raw: RawReviewer): ReviewRequest | null {
  if (raw?.login) return { user: raw.login }
  if (raw?.slug && raw.organization)
    return { team: `${raw.organization.login}/${raw.slug}` }
  return null
}

export function toSubjectDetails(
  kind: SubjectRef["kind"],
  raw: RawSubject
): SubjectDetails {
  return {
    kind,
    title: raw.title,
    url: raw.url,
    body: raw.body,
    createdAt: raw.createdAt,
    state: raw.state,
    isDraft: raw.isDraft ?? false,
    author: raw.author?.login ?? null,
    labels: raw.labels.nodes.map((label) => label.name),
    additions: raw.additions ?? null,
    deletions: raw.deletions ?? null,
    changedFiles: raw.changedFiles ?? null,
    headOid: raw.headRefOid ?? null,
    reviews: (raw.reviews?.nodes ?? []).flatMap((review) =>
      review.submittedAt && review.state !== "PENDING"
        ? [
            {
              author: review.author?.login ?? null,
              state: review.state,
              submittedAt: review.submittedAt,
              commitOid: review.commit?.oid ?? null,
            },
          ]
        : []
    ),
    ciState: raw.commits?.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    reviewDecision: raw.reviewDecision ?? null,
    mergeStateStatus: raw.mergeStateStatus ?? null,
    lastCommitAt: raw.commits?.nodes[0]?.commit.committedDate ?? null,
    reviewRequests: (raw.reviewRequests?.nodes ?? [])
      .map((node) => toReviewRequest(node.requestedReviewer))
      .filter((request) => request !== null),
    reviewRequestedAt: (raw.timelineItems?.nodes ?? []).flatMap((node) => {
      const reviewer = node.requestedReviewer
        ? toReviewRequest(node.requestedReviewer)
        : null
      return reviewer && node.createdAt
        ? [{ reviewer, createdAt: node.createdAt }]
        : []
    }),
    approvals: (raw.latestOpinionatedReviews?.nodes ?? []).filter(
      (review) => review.state === "APPROVED"
    ).length,
    comments: raw.comments.nodes.map(toComment),
    reviewThreads: (raw.reviewThreads?.nodes ?? []).map((thread) => ({
      isResolved: thread.isResolved,
      comments: thread.comments.nodes.map(toComment),
    })),
  }
}

const BATCH_SIZE = 5
const CONCURRENCY = 8

async function fetchBatch(
  octokit: Octokit,
  batch: SubjectRef[]
): Promise<[string, SubjectDetails][]> {
  const fields = batch
    .map((ref, index) => {
      const field = ref.kind === "PullRequest" ? "pullRequest" : "issue"
      const selection =
        ref.kind === "PullRequest" ? PULL_REQUEST_FIELDS : ISSUE_FIELDS
      return `s${index}: repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.repo)}) {
        subject: ${field}(number: ${ref.number}) { ${selection} }
      }`
    })
    .join("\n")

  let data: Record<string, { subject: RawSubject | null } | null>
  try {
    data = await octokit.graphql(`query { ${fields} }`)
  } catch (error) {
    // Partial errors (deleted repo, missing access) still carry the data.
    const partial = (error as { data?: typeof data }).data
    if (!partial) throw error
    data = partial
  }

  return batch.flatMap((ref, index): [string, SubjectDetails][] => {
    const subject = data[`s${index}`]?.subject
    return subject ? [[ref.key, toSubjectDetails(ref.kind, subject)]] : []
  })
}

/**
 * Fetches several subjects per GraphQL query through aliases, which keeps the
 * rate-limit cost low. Subjects that no longer exist are omitted.
 */
export async function fetchSubjects(
  octokit: Octokit,
  refs: SubjectRef[]
): Promise<Map<string, SubjectDetails>> {
  const batches: SubjectRef[][] = []
  for (let start = 0; start < refs.length; start += BATCH_SIZE) {
    batches.push(refs.slice(start, start + BATCH_SIZE))
  }
  const result = new Map<string, SubjectDetails>()
  for (let start = 0; start < batches.length; start += CONCURRENCY) {
    const settled = await Promise.all(
      batches
        .slice(start, start + CONCURRENCY)
        .map((batch) => fetchBatch(octokit, batch))
    )
    for (const [key, details] of settled.flat()) result.set(key, details)
  }
  return result
}

const STATE_BATCH_SIZE = 25

/** Cheap first pass: only the state, so closed subjects skip the full query. */
export async function fetchStates(
  octokit: Octokit,
  refs: SubjectRef[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const batches: SubjectRef[][] = []
  for (let start = 0; start < refs.length; start += STATE_BATCH_SIZE) {
    batches.push(refs.slice(start, start + STATE_BATCH_SIZE))
  }
  await Promise.all(
    batches.map(async (batch) => {
      const fields = batch
        .map((ref, index) => {
          const field = ref.kind === "PullRequest" ? "pullRequest" : "issue"
          return `s${index}: repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.repo)}) {
            subject: ${field}(number: ${ref.number}) { state }
          }`
        })
        .join("\n")
      let data: Record<string, { subject: { state: string } | null } | null>
      try {
        data = await octokit.graphql(`query { ${fields} }`)
      } catch (error) {
        const partial = (error as { data?: typeof data }).data
        if (!partial) throw error
        data = partial
      }
      batch.forEach((ref, index) => {
        const state = data[`s${index}`]?.subject?.state
        if (state) result.set(ref.key, state)
      })
    })
  )
  return result
}

export async function fetchSubject(
  octokit: Octokit,
  ref: SubjectRef
): Promise<SubjectDetails | null> {
  const subjects = await fetchSubjects(octokit, [ref])
  return subjects.get(ref.key) ?? null
}
