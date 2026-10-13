import type { Octokit } from "octokit"
import type { SprintProjectRef } from "./sprint"

type RawProjectItem = {
  id: string
  project: { number: number; owner: { login: string } }
  status: { name: string } | null
  priority: { name: string } | null
}

type RawItems = { projectItems: { nodes: RawProjectItem[] } }

export type RawFieldsSubject = RawItems & {
  closingIssuesReferences?: {
    nodes: (RawItems & {
      number: number
      repository: { nameWithOwner: string }
    })[]
  }
}

/** Where an item sits on the sprint project's board. */
export type ProjectFields = {
  /** The board item the fields are set on. */
  itemId: string
  status: string | null
  priority: string | null
  /** The issue the PR closes, when the fields come from it rather than the PR. */
  via: { key: string; number: number } | null
}

function onProject(items: RawItems, project: SprintProjectRef) {
  return items.projectItems.nodes.find(
    (item) =>
      item.project.number === project.number &&
      item.project.owner.login.toLowerCase() === project.owner.toLowerCase()
  )
}

/**
 * The item's own card on the board; a PR left off the board borrows the card
 * of the first issue it closes, where the team tracks the work.
 */
export function pickProjectFields(
  raw: RawFieldsSubject,
  project: SprintProjectRef
): ProjectFields | null {
  const own = onProject(raw, project)
  if (own)
    return {
      itemId: own.id,
      status: own.status?.name ?? null,
      priority: own.priority?.name ?? null,
      via: null,
    }
  for (const issue of raw.closingIssuesReferences?.nodes ?? []) {
    const card = onProject(issue, project)
    if (card)
      return {
        itemId: card.id,
        status: card.status?.name ?? null,
        priority: card.priority?.name ?? null,
        via: {
          key: `${issue.repository.nameWithOwner}#${issue.number}`,
          number: issue.number,
        },
      }
  }
  return null
}

const ITEMS = `
  projectItems(first: 10) {
    nodes {
      id
      project { number owner { ... on Organization { login } ... on User { login } } }
      status: fieldValueByName(name: $status) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
      priority: fieldValueByName(name: $priority) { ... on ProjectV2ItemFieldSingleSelectValue { name } }
    }
  }
`

export async function fetchProjectFields(
  octokit: Octokit,
  key: string,
  project: SprintProjectRef,
  fieldNames: { status: string; priority: string }
): Promise<ProjectFields | null> {
  const [repo, number] = key.split("#")
  const [owner, name] = repo.split("/")
  const data = await octokit.graphql<{
    repository: { issueOrPullRequest: RawFieldsSubject | null } | null
  }>(
    `query ($owner: String!, $name: String!, $number: Int!, $status: String!, $priority: String!) {
      repository(owner: $owner, name: $name) {
        issueOrPullRequest(number: $number) {
          ... on Issue { ${ITEMS} }
          ... on PullRequest {
            ${ITEMS}
            closingIssuesReferences(first: 5) {
              nodes { number repository { nameWithOwner } ${ITEMS} }
            }
          }
        }
      }
    }`,
    { owner, name, number: Number(number), ...fieldNames }
  )
  const subject = data.repository?.issueOrPullRequest
  return subject ? pickProjectFields(subject, project) : null
}
