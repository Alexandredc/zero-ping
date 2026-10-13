import type { Octokit } from "octokit"
import type { ScoreSubject } from "@/server/ai/scores"

/** One option of the project's Status field, in the board's order. */
export type SprintStatus = { id: string; name: string; color: string }

export type IssueLabel = { name: string; color: string }

export type WorkItem = {
  /** `owner/repo#number`, or the project item id for a draft. */
  key: string
  kind: "issue" | "pull" | "draft"
  number: number | null
  title: string
  url: string | null
  repo: string | null
  state: "OPEN" | "CLOSED" | "MERGED"
  assignees: string[]
  labels: IssueLabel[]
  updatedAt: string | null
  /** Status in the sprint project, when the item is on its board. */
  status: string | null
  /** The current sprint's title, when the item belongs to it. */
  sprint: string | null
  isEpic: boolean
  /** The item on the sprint project's board, which its status is set on. */
  projectItemId: string | null
  /** Jev's urgency, from 0 (can wait) to 3 (blocking); null until scored. */
  urgency: number | null
}

export type Iteration = { title: string; startDate: string; duration: number }

export type SprintProjectRef = { owner: string; number: number; title: string }

export type Sprint = {
  project: SprintProjectRef & { id: string }
  /** The Status field, to change an item's column. */
  statusFieldId: string | null
  iteration: Iteration | null
  statuses: SprintStatus[]
  items: WorkItem[]
}

/** Colors of GitHub's project options, as the board shows them. */
export const OPTION_COLOR: Record<string, string> = {
  GRAY: "#8b949e",
  BLUE: "#4493f8",
  GREEN: "#3fb950",
  YELLOW: "#d29922",
  ORANGE: "#db6d28",
  RED: "#f85149",
  PINK: "#db61a2",
  PURPLE: "#ab7df8",
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The iteration that contains `today`, from the field's planned iterations. */
export function currentIteration(
  iterations: Iteration[],
  today: Date = new Date()
): Iteration | null {
  return (
    iterations.find((iteration) => {
      const start = new Date(`${iteration.startDate}T00:00:00`).getTime()
      return (
        today.getTime() >= start &&
        today.getTime() < start + iteration.duration * DAY_MS
      )
    }) ?? null
  )
}

/** Day of the sprint, from 1 to its duration. */
export function sprintDay(iteration: Iteration, today: Date = new Date()) {
  const start = new Date(`${iteration.startDate}T00:00:00`).getTime()
  const day = Math.floor((today.getTime() - start) / DAY_MS) + 1
  return Math.min(Math.max(day, 1), iteration.duration)
}

/** Epics frame the sprint but are nobody's task: a Category field or the title tells them. */
export function isEpic(title: string, category: string | null): boolean {
  return /epic/i.test(category ?? "") || /^\s*\[epic\]/i.test(title)
}

/** The filter GitHub's project search expects for a field, quoted when it has spaces. */
export function currentIterationFilter(fieldName: string): string {
  const name = fieldName.toLowerCase()
  return `${/\s/.test(name) ? JSON.stringify(name) : name}:@current`
}

type RawContent =
  | {
      __typename: "Issue" | "PullRequest"
      number: number
      title: string
      url: string
      state: "OPEN" | "CLOSED" | "MERGED"
      updatedAt: string
      repository: { nameWithOwner: string }
      assignees: { nodes: { login: string }[] }
      labels: { nodes: IssueLabel[] } | null
      body: string
      author: { login: string } | null
      comments: RawComments
    }
  | {
      __typename: "DraftIssue"
      title: string
      updatedAt: string
      assignees: { nodes: { login: string }[] }
    }

type RawComments = {
  nodes: { author: { login: string } | null; body: string }[]
}

export type RawProjectItem = {
  id: string
  content: RawContent | null
  status: { name: string } | null
  category: { name: string } | null
}

export function toWorkItem(
  raw: RawProjectItem,
  sprint: string | null
): WorkItem | null {
  const content = raw.content
  // Items whose content the viewer cannot read come back empty.
  if (!content || !("__typename" in content)) return null
  const common = {
    title: content.title,
    assignees: content.assignees.nodes.map((a) => a.login),
    updatedAt: content.updatedAt,
    status: raw.status?.name ?? null,
    sprint,
    isEpic: isEpic(content.title, raw.category?.name ?? null),
    projectItemId: raw.id,
    urgency: null,
  }
  if (content.__typename === "DraftIssue")
    return {
      ...common,
      key: raw.id,
      kind: "draft",
      number: null,
      url: null,
      repo: null,
      state: "OPEN",
      labels: [],
    }
  return {
    ...common,
    key: `${content.repository.nameWithOwner}#${content.number}`,
    kind: content.__typename === "Issue" ? "issue" : "pull",
    number: content.number,
    url: content.url,
    repo: content.repository.nameWithOwner,
    state: content.state,
    labels: content.labels?.nodes ?? [],
  }
}

const CONTENT_FIELDS = `
  ... on Issue {
    __typename number title url state updatedAt
    repository { nameWithOwner }
    assignees(first: 10) { nodes { login } }
    labels(first: 6) { nodes { name color } }
    body author { login }
    comments(last: 3) { nodes { author { login } body } }
  }
  ... on PullRequest {
    __typename number title url state updatedAt
    repository { nameWithOwner }
    assignees(first: 10) { nodes { login } }
    labels(first: 6) { nodes { name color } }
    body author { login }
    comments(last: 3) { nodes { author { login } body } }
  }
  ... on DraftIssue {
    __typename title updatedAt
    assignees(first: 10) { nodes { login } }
  }
`

export type RawField =
  | {
      __typename: "ProjectV2IterationField"
      name: string
      configuration: { iterations: Iteration[] }
    }
  | {
      __typename: "ProjectV2SingleSelectField"
      id: string
      name: string
      options: { id: string; name: string; color: string }[]
    }
  | { __typename: "ProjectV2Field"; name: string }

const FIELDS = `
  fields(first: 50) {
    nodes {
      __typename
      ... on ProjectV2FieldCommon { name }
      ... on ProjectV2IterationField { configuration { iterations { title startDate duration } } }
      ... on ProjectV2SingleSelectField { id options { id name color } }
    }
  }
`

/** The project's sprint field: the iteration field named like a sprint, else the first one. */
export function sprintField(fields: RawField[]) {
  const iterations = fields.filter(
    (field) => field.__typename === "ProjectV2IterationField"
  )
  return (
    iterations.find((field) => /sprint/i.test(field.name)) ?? iterations.at(0)
  )
}

/** Open projects, of the given owners, that plan their work in iterations. */
export async function listSprintProjects(
  octokit: Octokit,
  owners: string[]
): Promise<SprintProjectRef[]> {
  const lists = await Promise.all(
    owners.map(async (owner) => {
      try {
        const data = await octokit.graphql<{
          repositoryOwner: {
            projectsV2?: {
              nodes: {
                number: number
                title: string
                closed: boolean
                fields: { nodes: RawField[] }
              }[]
            }
          } | null
        }>(
          `query ($owner: String!) {
            repositoryOwner(login: $owner) {
              ... on ProjectV2Owner {
                projectsV2(first: 20, orderBy: { field: NUMBER, direction: ASC }) {
                  nodes { number title closed ${FIELDS} }
                }
              }
            }
          }`,
          { owner }
        )
        return (data.repositoryOwner?.projectsV2?.nodes ?? [])
          .filter(
            (project) => !project.closed && sprintField(project.fields.nodes)
          )
          .map((project) => ({
            owner,
            number: project.number,
            title: project.title,
          }))
      } catch {
        // Projects need the read:project scope: without it, no sprint.
        return []
      }
    })
  )
  return lists.flat()
}

const MAX_SPRINT_PAGES = 5

type ItemsData = {
  repositoryOwner: {
    projectV2: {
      items: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: RawProjectItem[]
      }
    } | null
  } | null
}

/** The project's board: its title, the field holding the sprint and the Status options. */
export async function fetchSprintBoard(
  octokit: Octokit,
  project: Pick<SprintProjectRef, "owner" | "number">,
  today: Date = new Date()
) {
  const data = await octokit.graphql<{
    repositoryOwner: {
      projectV2: {
        id: string
        title: string
        fields: { nodes: RawField[] }
      } | null
    } | null
  }>(
    `query ($owner: String!, $number: Int!) {
      repositoryOwner(login: $owner) {
        ... on ProjectV2Owner { projectV2(number: $number) { id title ${FIELDS} } }
      }
    }`,
    { owner: project.owner, number: project.number }
  )
  const board = data.repositoryOwner?.projectV2
  if (!board)
    throw new Error(`Projet ${project.owner}/${project.number} introuvable.`)
  const fields = board.fields.nodes
  const field = sprintField(fields)
  const statusField = selectField(fields, /^status$/i)
  const priorityField = selectField(fields, /^priorit/i)
  return {
    project: { ...project, id: board.id, title: board.title },
    statusFieldId: statusField?.id ?? null,
    fieldName: field?.name ?? null,
    iteration:
      field?.__typename === "ProjectV2IterationField"
        ? currentIteration(field.configuration.iterations, today)
        : null,
    statuses: statusField?.options ?? [],
    priorityField: priorityField ?? null,
  }
}

/** A single-select field of the board, with its options in the board's colors. */
export function selectField(
  fields: RawField[],
  name: RegExp
): { id: string; name: string; options: SprintStatus[] } | undefined {
  const field = fields.find(
    (f): f is Extract<RawField, { __typename: "ProjectV2SingleSelectField" }> =>
      f.__typename === "ProjectV2SingleSelectField" && name.test(f.name)
  )
  return (
    field && {
      id: field.id,
      name: field.name,
      options: field.options.map((option) => ({
        id: option.id,
        name: option.name,
        color: OPTION_COLOR[option.color] ?? OPTION_COLOR.GRAY,
      })),
    }
  )
}

export async function fetchSprint(
  octokit: Octokit,
  project: Pick<SprintProjectRef, "owner" | "number">,
  today: Date = new Date()
): Promise<Sprint & { fieldName: string | null; subjects: ScoreSubject[] }> {
  const { priorityField: _, ...board } = await fetchSprintBoard(
    octokit,
    project,
    today
  )
  const { fieldName, iteration } = board
  if (!fieldName || !iteration) return { ...board, items: [], subjects: [] }

  const items: WorkItem[] = []
  const subjects: ScoreSubject[] = []
  let after: string | null = null
  for (let page = 0; page < MAX_SPRINT_PAGES; page++) {
    const data: ItemsData = await octokit.graphql<ItemsData>(
      `query ($owner: String!, $number: Int!, $filter: String!, $after: String) {
        repositoryOwner(login: $owner) {
          ... on ProjectV2Owner {
            projectV2(number: $number) {
              items(first: 100, after: $after, query: $filter) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content { ${CONTENT_FIELDS} }
                  status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
                  category: fieldValueByName(name: "Category") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
                }
              }
            }
          }
        }
      }`,
      {
        owner: project.owner,
        number: project.number,
        filter: currentIterationFilter(fieldName),
        after,
      }
    )
    const connection = data.repositoryOwner?.projectV2?.items
    if (!connection) break
    for (const raw of connection.nodes) {
      const item = toWorkItem(raw, iteration.title)
      if (item) items.push(item)
      const content = raw.content
      if (item && content && content.__typename !== "DraftIssue")
        subjects.push(
          toWorkSubject(
            content,
            content.__typename === "Issue" ? "Issue" : "PullRequest"
          )
        )
    }
    if (!connection.pageInfo.hasNextPage) break
    after = connection.pageInfo.endCursor
  }
  return { ...board, items, subjects }
}

type RawSearchIssue = {
  number: number
  title: string
  url: string
  state: "OPEN" | "CLOSED"
  updatedAt: string
  repository: { nameWithOwner: string }
  assignees: { nodes: { login: string }[] }
  labels: { nodes: IssueLabel[] }
  body: string
  author: { login: string } | null
  comments: RawComments
  projectItems: {
    nodes: {
      id: string
      project: { number: number; owner: { login: string } }
      status: { name: string } | null
      sprint: { title: string } | null
      category: { name: string } | null
    }[]
  }
}

/** The project item of an issue that matters here: the sprint project's, when it is on it. */
export function toAssignedItem(
  raw: RawSearchIssue,
  project: SprintProjectRef | null
): WorkItem {
  const onBoard = raw.projectItems.nodes.find(
    (item) =>
      project &&
      item.project.number === project.number &&
      item.project.owner.login.toLowerCase() === project.owner.toLowerCase()
  )
  return {
    key: `${raw.repository.nameWithOwner}#${raw.number}`,
    kind: "issue",
    number: raw.number,
    title: raw.title,
    url: raw.url,
    repo: raw.repository.nameWithOwner,
    state: raw.state,
    assignees: raw.assignees.nodes.map((a) => a.login),
    labels: raw.labels.nodes,
    updatedAt: raw.updatedAt,
    status: onBoard?.status?.name ?? null,
    sprint: onBoard?.sprint?.title ?? null,
    isEpic: isEpic(raw.title, onBoard?.category?.name ?? null),
    projectItemId: onBoard?.id ?? null,
    urgency: null,
  }
}

/** Open issues assigned to the viewer, the most recently updated first. */
export async function fetchAssignedIssues(
  octokit: Octokit,
  project: SprintProjectRef | null,
  sprintFieldName = "Sprint"
): Promise<{ items: WorkItem[]; subjects: ScoreSubject[] }> {
  const data = await octokit.graphql<{
    search: { nodes: (RawSearchIssue | Record<string, never>)[] }
  }>(
    `query ($sprintField: String!) {
      search(type: ISSUE, first: 100, query: "is:issue is:open assignee:@me archived:false sort:updated-desc") {
        nodes {
          ... on Issue {
            number title url state updatedAt
            repository { nameWithOwner }
            assignees(first: 10) { nodes { login } }
            labels(first: 6) { nodes { name color } }
            body author { login }
            comments(last: 3) { nodes { author { login } body } }
            projectItems(first: 10) {
              nodes {
                id
                project { number owner { ... on Organization { login } ... on User { login } } }
                status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
                sprint: fieldValueByName(name: $sprintField) { ... on ProjectV2ItemFieldIterationValue { title } }
                category: fieldValueByName(name: "Category") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              }
            }
          }
        }
      }
    }`,
    { sprintField: sprintFieldName }
  )
  const issues = data.search.nodes.filter(
    (node): node is RawSearchIssue => "number" in node
  )
  return {
    items: issues.map((raw) => toAssignedItem(raw, project)),
    subjects: issues.map((raw) => toWorkSubject(raw, "Issue")),
  }
}

/** Moves a project item to another column of the board. */
export async function setItemStatus(
  octokit: Octokit,
  input: {
    projectId: string
    itemId: string
    fieldId: string
    optionId: string
  }
) {
  await octokit.graphql(
    `mutation ($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }`,
    input
  )
}

type RawScorable = {
  number: number
  title: string
  url: string
  body: string
  author: { login: string } | null
  repository: { nameWithOwner: string }
  labels: { nodes: { name: string }[] } | null
  comments: RawComments
}

/** What Jev reads of a sprint ticket or an assigned issue. */
export function toWorkSubject(
  raw: RawScorable,
  kind: "Issue" | "PullRequest"
): ScoreSubject {
  return {
    key: `${raw.repository.nameWithOwner}#${raw.number}`,
    kind,
    title: raw.title,
    url: raw.url,
    body: raw.body,
    author: raw.author?.login ?? null,
    labels: raw.labels?.nodes.map((label) => label.name) ?? [],
    isDraft: false,
    additions: null,
    deletions: null,
    ciState: null,
    comments: raw.comments.nodes.map((comment) => ({
      author: comment.author?.login ?? null,
      body: comment.body,
    })),
  }
}
