import { describe, expect, it } from "vitest"
import {
  toWorkSubject,
  currentIteration,
  currentIterationFilter,
  isEpic,
  sprintDay,
  sprintField,
  toAssignedItem,
  toWorkItem,
} from "./sprint"

const iterations = [
  { title: "Sprint 53", startDate: "2026-10-11", duration: 14 },
  { title: "Sprint 54", startDate: "2026-10-25", duration: 14 },
]

describe("currentIteration", () => {
  it("finds the iteration that contains today, or none between sprints", () => {
    expect(
      currentIteration(iterations, new Date("2026-10-13T10:00:00"))?.title
    ).toBe("Sprint 53")
    expect(
      currentIteration(iterations, new Date("2026-10-25T00:00:00"))?.title
    ).toBe("Sprint 54")
    expect(
      currentIteration(iterations, new Date("2026-12-01T00:00:00"))
    ).toBeNull()
  })

  it("counts the sprint's days from 1", () => {
    expect(sprintDay(iterations[0], new Date("2026-10-11T08:00:00"))).toBe(1)
    expect(sprintDay(iterations[0], new Date("2026-10-13T18:00:00"))).toBe(3)
  })
})

describe("sprintField", () => {
  it("prefers the iteration field named like a sprint", () => {
    const field = sprintField([
      { __typename: "ProjectV2Field", name: "Title" },
      {
        __typename: "ProjectV2IterationField",
        name: "Framing start date",
        configuration: { iterations: [] },
      },
      {
        __typename: "ProjectV2IterationField",
        name: "Sprint",
        configuration: { iterations },
      },
    ])
    expect(field?.name).toBe("Sprint")
  })
})

describe("currentIterationFilter", () => {
  it("quotes field names with spaces", () => {
    expect(currentIterationFilter("Sprint")).toBe("sprint:@current")
    expect(currentIterationFilter("Dev sprint")).toBe('"dev sprint":@current')
  })
})

describe("isEpic", () => {
  it("reads the category or the title prefix", () => {
    expect(isEpic("Anything", "EPIC")).toBe(true)
    expect(isEpic("[Epic] Misc - bugs", null)).toBe(true)
    expect(isEpic("[US] Restriction d'accès", "User story")).toBe(false)
  })
})

describe("toWorkItem", () => {
  it("keys issues by repo and number and drafts by item id", () => {
    const issue = toWorkItem(
      {
        id: "PVTI_1",
        content: {
          __typename: "Issue",
          number: 42,
          title: "[US] Export",
          url: "https://github.com/acme/app/issues/42",
          state: "OPEN",
          updatedAt: "2026-10-12T10:00:00Z",
          repository: { nameWithOwner: "acme/app" },
          assignees: { nodes: [{ login: "lead" }] },
          labels: { nodes: [{ name: "bug", color: "d73a4a" }] },
          body: "Export the orders.",
          author: { login: "po" },
          comments: { nodes: [] },
        },
        status: { name: "📋 Todo" },
        category: { name: "User story" },
      },
      "Sprint 53"
    )
    expect(issue).toMatchObject({
      key: "acme/app#42",
      kind: "issue",
      assignees: ["lead"],
      status: "📋 Todo",
      sprint: "Sprint 53",
      isEpic: false,
      projectItemId: "PVTI_1",
    })
    const draft = toWorkItem(
      {
        id: "PVTI_2",
        content: {
          __typename: "DraftIssue",
          title: "Idée",
          updatedAt: "2026-10-12T10:00:00Z",
          assignees: { nodes: [] },
        },
        status: null,
        category: null,
      },
      "Sprint 53"
    )
    expect(draft).toMatchObject({ key: "PVTI_2", kind: "draft", url: null })
  })

  it("drops items the viewer cannot read", () => {
    expect(
      toWorkItem({ id: "x", content: null, status: null, category: null }, null)
    ).toBeNull()
  })
})

describe("toAssignedItem", () => {
  it("reads the status and sprint from the sprint project only", () => {
    const item = toAssignedItem(
      {
        number: 7,
        title: "Fix login",
        url: "https://github.com/acme/app/issues/7",
        state: "OPEN",
        updatedAt: "2026-10-12T10:00:00Z",
        repository: { nameWithOwner: "acme/app" },
        assignees: { nodes: [{ login: "lead" }] },
        labels: { nodes: [] },
        body: "",
        author: null,
        comments: { nodes: [] },
        projectItems: {
          nodes: [
            {
              id: "PVTI_other",
              project: { number: 9, owner: { login: "acme" } },
              status: { name: "Done" },
              sprint: null,
              category: null,
            },
            {
              id: "PVTI_sprint",
              project: { number: 1, owner: { login: "Acme" } },
              status: { name: "🔍 Review" },
              sprint: { title: "Sprint 53" },
              category: null,
            },
          ],
        },
      },
      { owner: "acme", number: 1, title: "Acme" }
    )
    expect(item.status).toBe("🔍 Review")
    expect(item.sprint).toBe("Sprint 53")
    expect(item.projectItemId).toBe("PVTI_sprint")
  })
})

describe("toWorkSubject", () => {
  it("gives Jev the ticket's description, labels and latest comments", () => {
    expect(
      toWorkSubject(
        {
          number: 7,
          title: "[BUG] Pics de trafic",
          url: "u",
          body: "500 en prod",
          author: { login: "po" },
          repository: { nameWithOwner: "acme/app" },
          labels: { nodes: [{ name: "bug" }] },
          comments: { nodes: [{ author: null, body: "Toujours là" }] },
        },
        "Issue"
      )
    ).toMatchObject({
      key: "acme/app#7",
      kind: "Issue",
      body: "500 en prod",
      labels: ["bug"],
      comments: [{ author: null, body: "Toujours là" }],
    })
  })
})
