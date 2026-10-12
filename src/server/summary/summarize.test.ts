import { describe, expect, it } from "vitest"
import {
  buildSummaryInput,
  buildSummaryPrompt,
  parseSummary,
} from "./summarize"
import type { Item } from "@/server/db/schema"
import type { Conversation } from "@/server/github/conversation"

const item = {
  key: "acme/api#8",
  repoFullName: "acme/api",
  number: 8,
  kind: "PullRequest",
  title: "Add retries",
  labels: ["hotfix"],
  additions: 40,
  deletions: 2,
  ciState: "SUCCESS",
  state: "OPEN",
} as Item

const comment = (author: string, body: string, createdAt: string) => ({
  id: `${author}-${createdAt}`,
  databaseId: 1,
  author,
  authorAvatar: null,
  body,
  createdAt,
  url: "https://github.com/acme/api/pull/8",
})

const conversation: Conversation = {
  kind: "PullRequest",
  title: "Add retries",
  url: "https://github.com/acme/api/pull/8",
  state: "OPEN",
  description: comment(
    "dev",
    "Retries failed webhooks.",
    "2026-10-10T09:00:00Z"
  ),
  entries: [
    {
      type: "review",
      state: "CHANGES_REQUESTED",
      ...comment("lead", "Cap the retries.", "2026-10-11T09:00:00Z"),
    },
    {
      type: "thread",
      id: "t1",
      path: "src/retry.ts",
      line: 12,
      isResolved: false,
      createdAt: "2026-10-11T10:00:00Z",
      comments: [comment("lead", "Why 10?", "2026-10-11T10:00:00Z")],
    },
  ],
}

describe("buildSummaryInput", () => {
  it("lays out the GitHub conversation and the Slack threads", () => {
    const input = buildSummaryInput(item, conversation, [
      {
        channel: "#pull-requests",
        permalink: "https://acme.slack.com/archives/C1/p1",
        match: "link",
        messages: [
          {
            author: "Dev",
            text: "ready again",
            postedAt: "2026-10-12T08:00:00Z",
          },
        ],
      },
    ])
    expect(input).toContain("# Pull request acme/api#8: Add retries")
    expect(input).toContain("Labels: hotfix")
    expect(input).toContain("dev (description):\nRetries failed webhooks.")
    expect(input).toContain(
      "lead (review CHANGES_REQUESTED):\nCap the retries."
    )
    expect(input).toContain("--- Review thread on src/retry.ts:12")
    expect(input).toContain("## Slack thread in #pull-requests")
    expect(input).toContain("Dev:\nready again")
  })

  it("bounds very long conversations", () => {
    const long = {
      ...conversation,
      description: comment("dev", "x".repeat(200_000), "2026-10-10T09:00:00Z"),
    }
    const input = buildSummaryInput(item, long, [])
    expect(input.length).toBeLessThan(121_000)
    expect(input).toMatch(/\[Conversation truncated\]$/)
  })
})

describe("summary prompt and answer", () => {
  it("asks for French and for what the reader must do", () => {
    const prompt = buildSummaryPrompt("lead")
    expect(prompt).toContain("in French")
    expect(prompt).toContain("lead is expected to do")
  })

  it("validates the structured answer", () => {
    const content = {
      tldr: "Ajoute des retries.",
      status: "Changements demandés.",
      expectedFromMe: "",
      openQuestions: ["Pourquoi 10 ?"],
      risks: [],
    }
    expect(parseSummary(content)).toEqual(content)
    expect(() => parseSummary({ tldr: "x" })).toThrow()
  })
})

describe("summary lengths", () => {
  it("gives each length its own budget", () => {
    expect(buildSummaryPrompt("lead", "short")).toContain(
      "one sentence of at most 25 words"
    )
    expect(buildSummaryPrompt("lead", "standard")).toContain(
      "at most 4 short bullet points"
    )
    expect(buildSummaryPrompt("lead", "detailed")).toContain(
      "Cover every decision"
    )
  })
})
