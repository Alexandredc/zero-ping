import type { Octokit } from "octokit"

export type ConversationComment = {
  id: string
  databaseId: number | null
  author: string | null
  authorAvatar: string | null
  body: string
  createdAt: string
  url: string
}

export type ConversationEntry =
  | ({ type: "comment" } & ConversationComment)
  | ({ type: "review"; state: string } & ConversationComment)
  | {
      type: "thread"
      id: string
      path: string
      line: number | null
      isResolved: boolean
      createdAt: string
      comments: ConversationComment[]
    }

export type Conversation = {
  kind: "PullRequest" | "Issue"
  title: string
  url: string
  state: string
  description: ConversationComment
  entries: ConversationEntry[]
}

const COMMENT_FIELDS = `id databaseId author { login avatarUrl } body createdAt url`

type RawComment = {
  id: string
  databaseId: number | null
  author: { login: string; avatarUrl: string } | null
  body: string
  createdAt: string
  url: string
}

function toComment(raw: RawComment): ConversationComment {
  return {
    id: raw.id,
    databaseId: raw.databaseId,
    author: raw.author?.login ?? null,
    authorAvatar: raw.author?.avatarUrl ?? null,
    body: raw.body,
    createdAt: raw.createdAt,
    url: raw.url,
  }
}

export async function fetchConversation(
  octokit: Octokit,
  ref: {
    owner: string
    repo: string
    number: number
    kind: "PullRequest" | "Issue"
  }
): Promise<Conversation | null> {
  const isPull = ref.kind === "PullRequest"
  const pullFields = isPull
    ? `
      reviews(first: 50) { nodes { state ${COMMENT_FIELDS} } }
      reviewThreads(first: 50) {
        nodes { id path line isResolved comments(first: 50) { nodes { ${COMMENT_FIELDS} } } }
      }`
    : ""
  const data = await octokit.graphql<{
    repository: {
      subject: {
        title: string
        url: string
        state: string
        id: string
        author: { login: string; avatarUrl: string } | null
        body: string
        createdAt: string
        comments: { nodes: RawComment[] }
        reviews?: { nodes: (RawComment & { state: string })[] }
        reviewThreads?: {
          nodes: {
            id: string
            path: string
            line: number | null
            isResolved: boolean
            comments: { nodes: RawComment[] }
          }[]
        }
      } | null
    }
  }>(
    `query ($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        subject: ${isPull ? "pullRequest" : "issue"}(number: $number) {
          id title url state author { login avatarUrl } body createdAt
          comments(first: 100) { nodes { ${COMMENT_FIELDS} } }
          ${pullFields}
        }
      }
    }`,
    { owner: ref.owner, repo: ref.repo, number: ref.number }
  )

  const subject = data.repository.subject
  if (!subject) return null

  const threadCommentIds = new Set(
    (subject.reviewThreads?.nodes ?? []).flatMap((thread) =>
      thread.comments.nodes.map((comment) => comment.id)
    )
  )

  const entries: ConversationEntry[] = [
    ...subject.comments.nodes.map((raw) => ({
      type: "comment" as const,
      ...toComment(raw),
    })),
    // Reviews without a summary only carry inline comments, shown in their threads.
    ...(subject.reviews?.nodes ?? [])
      .filter(
        (review) => review.body.trim() !== "" || review.state !== "COMMENTED"
      )
      .filter((review) => !threadCommentIds.has(review.id))
      .map((raw) => ({
        type: "review" as const,
        state: raw.state,
        ...toComment(raw),
      })),
    ...(subject.reviewThreads?.nodes ?? [])
      .filter((thread) => thread.comments.nodes.length > 0)
      .map((thread) => ({
        type: "thread" as const,
        id: thread.id,
        path: thread.path,
        line: thread.line,
        isResolved: thread.isResolved,
        createdAt: thread.comments.nodes[0].createdAt,
        comments: thread.comments.nodes.map(toComment),
      })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return {
    kind: ref.kind,
    title: subject.title,
    url: subject.url,
    state: subject.state,
    description: toComment({ ...subject, databaseId: null }),
    entries,
  }
}
