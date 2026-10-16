import type { Experimental_DecisionModelV4CallOptions } from "@ai-sdk/provider"
import { Experimental_DecisionMockModelV4 } from "ai/test"
import { describe, expect, it } from "vitest"
import { assessReadiness } from "./rules"
import type { Readiness } from "./rules"
import { askWait, checkWait, referencedPull, waitHash } from "./wait"
import type { WaitInput } from "./wait"

let title = 0
function input(overrides: Partial<WaitInput> = {}): WaitInput {
  // A distinct title per test keeps Jev's cache from answering across tests.
  title += 1
  return {
    number: 10570,
    title: `feat: billing export ${title}`,
    body: "Adds the export. Fixes #10500.",
    author: "dev",
    labels: [],
    comments: [],
    ...overrides,
  }
}

function mockModel(wait: number, reason: string) {
  const calls: Experimental_DecisionModelV4CallOptions[] = []
  const model = new Experimental_DecisionMockModelV4({
    provider: "typesafe",
    doDecide: async (options) => {
      calls.push(options)
      return {
        answers: {
          wait: { type: "boolean", probability: wait },
          reason: { type: "choice", choice: reason },
        } as never,
        warnings: [],
      }
    },
  })
  return { model, calls }
}

const ready = assessReadiness({
  isDraft: false,
  reviewDecision: "APPROVED",
  mergeStateStatus: "CLEAN",
  lastCommitAt: null,
  reviews: [],
  reviewThreads: [],
})

describe("referencedPull", () => {
  it("takes the newest comment's reference, never the PR itself", () => {
    expect(
      referencedPull(
        input({
          comments: [
            {
              author: "lead",
              body: "Wait for #10500",
              createdAt: "2026-10-15T09:00:00Z",
            },
            {
              author: "dev",
              body: "This one (#10570) needs #10569 merged first",
              createdAt: "2026-10-15T10:00:00Z",
            },
          ],
        })
      )
    ).toBe(10569)
    expect(
      referencedPull(
        input({ body: "Needs https://github.com/acme/api/pull/77 first" })
      )
    ).toBe(77)
    expect(referencedPull(input({ body: "Nothing here, see #10570" }))).toBe(
      null
    )
  })
})

describe("askWait", () => {
  it("returns the reason and the PR to wait for", async () => {
    const { model, calls } = mockModel(0.92, "dependency")
    const gap = await askWait(
      model,
      input({ body: "Do not merge before #10569 is in." })
    )
    expect(gap).toEqual({ kind: "wait", reason: "dependency", pull: 10569 })
    expect(Object.keys(calls[0].questions)).toEqual(["wait", "reason"])
  })

  it("says nothing below the threshold", async () => {
    const { model } = mockModel(0.2, "hold")
    expect(await askWait(model, input())).toBeNull()
  })
})

describe("checkWait", () => {
  it("never asks Jev about a PR the rules block", async () => {
    const { model, calls } = mockModel(0.9, "hold")
    const almost: Readiness = {
      status: "almost",
      gaps: [{ kind: "behind" }],
      waitHash: null,
    }
    expect(await checkWait(model, almost, input(), null)).toBe(almost)
    const computing: Readiness = {
      status: "computing",
      gaps: [],
      waitHash: null,
    }
    expect(await checkWait(model, computing, input(), null)).toBe(computing)
    expect(calls).toHaveLength(0)
  })

  it("keeps the rules' verdict without a model", async () => {
    expect(await checkWait(null, ready, input(), null)).toBe(ready)
  })

  it("asks once per unchanged PR", async () => {
    const { model, calls } = mockModel(0.9, "freeze")
    const subject = input()
    const first = await checkWait(model, ready, subject, null)
    expect(first).toEqual({
      status: "almost",
      gaps: [{ kind: "wait", reason: "freeze", pull: null }],
      waitHash: waitHash(subject),
    })
    // From the stored answer, as after a restart, then from the cache.
    expect(await checkWait(model, ready, subject, first)).toEqual(first)
    expect(await checkWait(model, ready, subject, null)).toEqual(first)
    expect(calls).toHaveLength(1)
  })

  it("asks again once the discussion changes", async () => {
    const { model, calls } = mockModel(0.1, "other")
    const subject = input()
    const first = await checkWait(model, ready, subject, null)
    expect(first.status).toBe("ready")
    await checkWait(
      model,
      ready,
      {
        ...subject,
        comments: [
          {
            author: "lead",
            body: "Merge freeze until Monday",
            createdAt: "2026-10-16T08:00:00Z",
          },
        ],
      },
      first
    )
    expect(calls).toHaveLength(2)
  })

  it("falls back to the rules when Jev fails", async () => {
    const model = new Experimental_DecisionMockModelV4({
      provider: "typesafe",
      doDecide: () => Promise.reject(new Error("down")),
    })
    const original = console.error
    console.error = () => {}
    try {
      expect(await checkWait(model, ready, input(), null)).toBe(ready)
    } finally {
      console.error = original
    }
  })
})
