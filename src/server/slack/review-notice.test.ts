import { describe, expect, it } from "vitest"
import { buildNoticePrompt, draftReviewNotice } from "./review-notice"

const pull = {
  repoFullName: "acme/acme-web",
  number: 9026,
  title: "round the shipping fees",
  url: "https://github.com/acme/acme-web/pull/9026",
  author: "teammate",
}

describe("draftReviewNotice", () => {
  it("links the PR and pings its author by handle", () => {
    expect(draftReviewNotice({ ...pull, event: "APPROVE" })).toBe(
      "✅ J'ai approuvé acme-web#9026 (round the shipping fees) : @teammate c'est bon pour moi, tu peux merger.\nhttps://github.com/acme/acme-web/pull/9026"
    )
    expect(draftReviewNotice({ ...pull, event: "REQUEST_CHANGES" })).toMatch(
      /^🔁 .* @teammate je t'ai laissé des retours\.\n/
    )
  })
})

describe("buildNoticePrompt", () => {
  it("replies in the PR's thread when there is one", () => {
    const prompt = buildNoticePrompt(
      { thread: { channelId: "C1", threadTs: "1.2" } },
      "Salut",
      []
    )
    expect(prompt).toContain('channel_id "C1" and thread_ts "1.2"')
    expect(prompt).not.toContain("Slack mention")
  })

  it("posts in the channel and only turns the listed handles into mentions", () => {
    const prompt = buildNoticePrompt(
      { channel: "#pull-requests" },
      "@teammate merci",
      [{ login: "teammate", name: "Robin Garnier" }]
    )
    expect(prompt).toContain("in the channel #pull-requests")
    expect(prompt).toContain("- @teammate (Robin Garnier)")
    expect(prompt).toContain(JSON.stringify("@teammate merci"))
  })
})
