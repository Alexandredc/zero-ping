import type { NewItem, SubjectKind } from "@/server/db/schema"

export type RawNotification = {
  id: string
  unread: boolean
  reason: string
  updated_at: string
  subject: { title: string; url: string | null; type: string }
  repository: { full_name: string; html_url: string }
}

export type SubjectLocation = {
  key: string
  kind: SubjectKind
  number: number | null
  htmlUrl: string
}

const SUBJECT_URL = /\/repos\/([^/]+)\/([^/]+)\/(pulls|issues)\/(\d+)$/

export function locateSubject(notification: RawNotification): SubjectLocation {
  const match = notification.subject.url?.match(SUBJECT_URL)
  if (match) {
    const [, owner, repo, type, number] = match
    const isPull = type === "pulls"
    return {
      key: `${owner}/${repo}#${number}`,
      kind: isPull ? "PullRequest" : "Issue",
      number: Number(number),
      htmlUrl: `https://github.com/${owner}/${repo}/${isPull ? "pull" : "issues"}/${number}`,
    }
  }
  const isDiscussion = notification.subject.type === "Discussion"
  return {
    key: `thread:${notification.id}`,
    kind: isDiscussion ? "Discussion" : "Other",
    number: null,
    htmlUrl: isDiscussion
      ? `${notification.repository.html_url}/discussions`
      : notification.repository.html_url,
  }
}

export function toItem(notification: RawNotification): NewItem {
  const location = locateSubject(notification)
  return {
    key: location.key,
    repoFullName: notification.repository.full_name,
    number: location.number,
    kind: location.kind,
    subjectType: notification.subject.type,
    title: notification.subject.title,
    htmlUrl: location.htmlUrl,
    threadId: notification.id,
    reason: notification.reason,
    unread: notification.unread,
    updatedAt: new Date(notification.updated_at),
  }
}

export function parseSubjectKey(
  key: string
): { owner: string; repo: string; number: number } | null {
  const match = key.match(/^([^/]+)\/([^#]+)#(\d+)$/)
  return match
    ? { owner: match[1], repo: match[2], number: Number(match[3]) }
    : null
}
