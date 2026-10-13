import type { Octokit } from "octokit"
import { TEAM_PREFIX } from "@/server/team/labels"
import { messagesFor } from "@/lib/i18n/messages"
import type { Language } from "@/lib/i18n/core"

type Ref = { owner: string; repo: string; number: number }

export type ReviewerCandidate = {
  /** A login, or `team:<slug>` for a team. */
  id: string
  label: string
  /** The full name, or the team's name. */
  name: string | null
  kind: "user" | "team"
  /** GitHub suggests them from the history of the changed files. */
  suggested: boolean
  /** Their latest review on the PR, when they already gave one. */
  reviewState: string | null
}

export type ReviewerOptions = {
  /** Reviewers currently requested, people and `team:<slug>` teams. */
  requested: string[]
  candidates: ReviewerCandidate[]
}

type RawUser = { login: string; name: string | null }

export type RawReviewerOptions = {
  pullRequest: {
    author: { login: string } | null
    suggestedReviewers: ({ reviewer: RawUser } | null)[]
    reviewRequests: {
      nodes: {
        requestedReviewer: {
          login?: string
          name?: string | null
          slug?: string
        } | null
      }[]
    }
    latestOpinionatedReviews: {
      nodes: { author: { login: string } | null; state: string }[]
    }
  }
  assignableUsers: { nodes: RawUser[] }
}

export type RawTeam = { slug: string; name: string }

export function toReviewerOptions(
  raw: RawReviewerOptions,
  teams: RawTeam[],
  viewerLogin: string,
  language: Language
): ReviewerOptions {
  const t = messagesFor(language)
  const pull = raw.pullRequest
  const lower = (login: string) => login.toLowerCase()
  const author = pull.author ? lower(pull.author.login) : null
  const suggested = new Set(
    pull.suggestedReviewers.flatMap((s) => (s ? [lower(s.reviewer.login)] : []))
  )
  const reviewStates = new Map(
    pull.latestOpinionatedReviews.nodes.flatMap((review) =>
      review.author ? [[lower(review.author.login), review.state] as const] : []
    )
  )
  const requested = pull.reviewRequests.nodes.flatMap(
    ({ requestedReviewer }) => {
      if (requestedReviewer?.login) return [requestedReviewer.login]
      if (requestedReviewer?.slug)
        return [`${TEAM_PREFIX}${requestedReviewer.slug}`]
      return []
    }
  )

  const users = new Map<string, RawUser>()
  const addUser = (user: RawUser) => {
    // GitHub refuses the author as reviewer of their own PR.
    if (lower(user.login) !== author && !users.has(lower(user.login)))
      users.set(lower(user.login), user)
  }
  pull.suggestedReviewers.forEach((s) => s && addUser(s.reviewer))
  pull.reviewRequests.nodes.forEach(({ requestedReviewer }) => {
    if (requestedReviewer?.login)
      addUser({
        login: requestedReviewer.login,
        name: requestedReviewer.name ?? null,
      })
  })
  raw.assignableUsers.nodes.forEach(addUser)

  const viewer = lower(viewerLogin)
  const people: ReviewerCandidate[] = [...users.values()].map((user) => ({
    id: user.login,
    label:
      lower(user.login) === viewer
        ? t.server.reviewers.viewer(user.login)
        : `@${user.login}`,
    name: user.name || null,
    kind: "user",
    suggested: suggested.has(lower(user.login)),
    reviewState: reviewStates.get(lower(user.login)) ?? null,
  }))
  // Suggested people first, then those who already know the PR, then the rest.
  const rank = (candidate: ReviewerCandidate) =>
    candidate.suggested ? 0 : candidate.reviewState ? 1 : 2
  people.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id, language))

  // A requested team stays listed, so it can be withdrawn, even without read:org.
  const teamSlugs = new Set(teams.map((team) => lower(team.slug)))
  const requestedTeams = requested
    .filter((id) => id.startsWith(TEAM_PREFIX))
    .map((id) => id.slice(TEAM_PREFIX.length))
    .filter((slug) => !teamSlugs.has(lower(slug)))
    .map((slug) => ({ slug, name: slug }))
  const teamCandidates: ReviewerCandidate[] = [...teams, ...requestedTeams]
    .map((team) => ({
      id: `${TEAM_PREFIX}${team.slug}`,
      label: t.server.reviewers.team(team.slug),
      name: team.name === team.slug ? null : team.name,
      kind: "team" as const,
      suggested: false,
      reviewState: null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id, language))

  return { requested, candidates: [...people, ...teamCandidates] }
}

/** Splits a reviewer list into the logins and team slugs that the REST API expects. */
export function splitReviewers(reviewers: string[]) {
  return {
    reviewers: reviewers.filter((r) => !r.startsWith(TEAM_PREFIX)),
    team_reviewers: reviewers
      .filter((r) => r.startsWith(TEAM_PREFIX))
      .map((r) => r.slice(TEAM_PREFIX.length)),
  }
}

/** What to request and what to withdraw so that the PR ends with `wanted`. */
export function reviewerChanges(requested: string[], wanted: string[]) {
  const has = (list: string[], id: string) =>
    list.some((other) => other.toLowerCase() === id.toLowerCase())
  return {
    add: wanted.filter((id) => !has(requested, id)),
    remove: requested.filter((id) => !has(wanted, id)),
  }
}

export async function fetchReviewerOptions(
  octokit: Octokit,
  ref: Ref,
  viewerLogin: string,
  language: Language
): Promise<ReviewerOptions> {
  const [data, teams] = await Promise.all([
    octokit.graphql<{ repository: RawReviewerOptions }>(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            author { login }
            suggestedReviewers { reviewer { login name } }
            reviewRequests(first: 30) {
              nodes { requestedReviewer { ... on User { login name } ... on Team { slug } } }
            }
            latestOpinionatedReviews(first: 30) { nodes { author { login } state } }
          }
          assignableUsers(first: 100) { nodes { login name } }
        }
      }`,
      { owner: ref.owner, repo: ref.repo, number: ref.number }
    ),
    // Listing teams needs the read:org scope: without it, only people are offered.
    octokit.rest.repos
      .listTeams({ owner: ref.owner, repo: ref.repo, per_page: 100 })
      .then((response) => response.data as RawTeam[])
      .catch(() => []),
  ])
  return toReviewerOptions(data.repository, teams, viewerLogin, language)
}

/** Requests the new reviewers and withdraws the removed ones on GitHub. */
export async function updateReviewers(
  octokit: Octokit,
  ref: Ref,
  changes: { add: string[]; remove: string[] }
) {
  const pull = { owner: ref.owner, repo: ref.repo, pull_number: ref.number }
  if (changes.add.length > 0)
    await octokit.rest.pulls.requestReviewers({
      ...pull,
      ...splitReviewers(changes.add),
    })
  if (changes.remove.length > 0)
    await octokit.rest.pulls.removeRequestedReviewers({
      ...pull,
      ...splitReviewers(changes.remove),
    })
}
