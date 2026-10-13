import { describe, expect, it } from "vitest"
import { pickProjectFields } from "./project-fields"

const project = { owner: "acme", number: 1, title: "Roadmap" }

function card(id: string, projectNumber: number, status: string | null) {
  return {
    id,
    project: { number: projectNumber, owner: { login: "Acme" } },
    status: status ? { name: status } : null,
    priority: { name: "P1" },
  }
}

describe("pickProjectFields", () => {
  it("reads the item's own card on the sprint project", () => {
    expect(
      pickProjectFields(
        {
          projectItems: {
            nodes: [card("other", 2, "Done"), card("own", 1, "🔍 Review")],
          },
        },
        project
      )
    ).toEqual({ itemId: "own", status: "🔍 Review", priority: "P1", via: null })
  })

  it("falls back on the card of an issue the PR closes", () => {
    expect(
      pickProjectFields(
        {
          projectItems: { nodes: [] },
          closingIssuesReferences: {
            nodes: [
              {
                number: 7,
                repository: { nameWithOwner: "acme/api" },
                projectItems: { nodes: [card("issue", 1, null)] },
              },
            ],
          },
        },
        project
      )
    ).toEqual({
      itemId: "issue",
      status: null,
      priority: "P1",
      via: { key: "acme/api#7", number: 7 },
    })
  })

  it("gives nothing when neither is on the board", () => {
    expect(
      pickProjectFields(
        { projectItems: { nodes: [card("other", 2, "Done")] } },
        project
      )
    ).toBeNull()
  })
})
