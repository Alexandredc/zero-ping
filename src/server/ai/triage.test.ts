import type { Experimental_DecisionModelV4CallOptions } from "@ai-sdk/provider"
import { Experimental_DecisionMockModelV4 } from "ai/test"
import { describe, expect, it } from "vitest"
import { buildTriageState, triage, triageHash } from "./triage"
import type { TriageInput } from "./triage"
import type { SubjectDetails } from "@/server/inbox/analyze"

const details: SubjectDetails = {
  kind: "PullRequest",
  title: "Fix checkout crash in production",
  url: "https://github.com/acme/shop/pull/7",
  body: "Customers cannot pay since this morning.",
  createdAt: "2026-10-12T08:00:00Z",
  state: "OPEN",
  isDraft: false,
  author: "dev",
  labels: ["hotfix"],
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  headOid: null,
  reviews: [],
  ciState: "SUCCESS",
  reviewDecision: null,
  reviewRequests: [{ user: "lead" }],
  reviewRequestedAt: [],
  approvals: 0,
  comments: [],
  reviewThreads: [],
}

const input: TriageInput = { details, awaiting: null, viewerLogin: "lead" }

function mockModel(answers: Record<string, unknown>) {
  const calls: Experimental_DecisionModelV4CallOptions[] = []
  const model = new Experimental_DecisionMockModelV4({
    provider: "typesafe",
    doDecide: async (options) => {
      calls.push(options)
      return {
        answers: answers as never,
        warnings: [],
        providerMetadata: { typesafe: { confidence: { urgency: 0.83 } } },
      }
    },
  })
  return { model, calls }
}

describe("triage", () => {
  it("asks only for urgency when nobody waits for the viewer", async () => {
    const { model, calls } = mockModel({
      urgency: { type: "score", score: 2.6 },
    })
    const result = await triage(model, input)
    expect(result).toEqual({
      urgency: 2.6,
      confidence: 0.83,
      questionProbability: null,
    })
    expect(Object.keys(calls[0].questions)).toEqual(["urgency"])
  })

  it("also asks whether the pending message is a question", async () => {
    const { model, calls } = mockModel({
      urgency: { type: "score", score: 1 },
      question: { type: "boolean", probability: 0.91 },
    })
    const result = await triage(model, {
      ...input,
      awaiting: {
        url: "u",
        excerpt: "@lead can we ship today?",
        from: "dev",
        since: new Date(),
      },
    })
    expect(result.questionProbability).toBe(0.91)
    expect(Object.keys(calls[0].questions)).toEqual(["urgency", "question"])
  })
})

describe("triageHash", () => {
  it("changes only when the triage inputs change", () => {
    expect(triageHash(input)).toBe(
      triageHash({ ...input, details: { ...details } })
    )
    expect(triageHash(input)).not.toBe(
      triageHash({
        ...input,
        details: { ...details, labels: ["hotfix", "p0"] },
      })
    )
  })
})

describe("buildTriageState", () => {
  it("adds the board's priority only for an item that has a card", () => {
    expect(buildTriageState(input)).not.toHaveProperty("projectPriority")
    expect(triageHash({ ...input, projectPriority: null })).toBe(
      triageHash(input)
    )
    expect(buildTriageState({ ...input, projectPriority: "P0" })).toMatchObject(
      { projectPriority: "P0" }
    )
  })
})
