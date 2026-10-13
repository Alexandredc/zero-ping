import { describe, expect, it } from "vitest"
import { toTriageInput, trustedUrgency } from "./scores"
import { buildTriageState } from "./triage"

describe("trustedUrgency", () => {
  it("drops answers Jev was unsure of", () => {
    expect(trustedUrgency({ urgency: 2, confidence: 0.9 })).toBe(2)
    expect(trustedUrgency({ urgency: 3, confidence: 0.3 })).toBeNull()
    expect(trustedUrgency({ urgency: 1, confidence: null })).toBe(1)
    expect(trustedUrgency(undefined)).toBeNull()
  })
})

describe("toTriageInput", () => {
  it("feeds Jev the same state as for an inbox item", () => {
    const state = buildTriageState(
      toTriageInput(
        {
          key: "acme/app#7",
          kind: "Issue",
          title: "Peak season",
          url: "u",
          body: "Block big orders",
          author: "po",
          labels: ["bug"],
          isDraft: false,
          additions: null,
          deletions: null,
          ciState: null,
          comments: [{ author: "lead", body: "Urgent avant vendredi" }],
        },
        "lead"
      )
    )
    expect(state).toMatchObject({
      reader: "lead",
      kind: "Issue",
      title: "Peak season",
      description: "Block big orders",
      labels: ["bug"],
      latestComments: [{ author: "lead", body: "Urgent avant vendredi" }],
      messageForReader: null,
    })
  })
})
