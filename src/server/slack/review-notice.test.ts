import { describe, expect, it } from "vitest"
import { buildNoticePrompt, draftReviewNotice } from "./review-notice"
import { messagesFor } from "@/lib/i18n/messages"

const fr = messagesFor("fr")

const pull = {
  repoFullName: "acme/acme-api",
  number: 9026,
  title: "round the shipping fees",
  url: "https://github.com/acme/acme-api/pull/9026",
  author: "jdoe",
}

describe("draftReviewNotice", () => {
  it("links the PR and pings its author by handle", () => {
    expect(draftReviewNotice({ ...pull, event: "APPROVE" }, fr)).toBe(
      "✅ J'ai approuvé acme-api#9026 (round the shipping fees) : @jdoe c'est bon pour moi, tu peux merger.\nhttps://github.com/acme/acme-api/pull/9026"
    )
    expect(
      draftReviewNotice({ ...pull, event: "REQUEST_CHANGES" }, fr)
    ).toMatch(/^🔁 .* @jdoe je t'ai laissé des retours\.\n/)
  })

  it("drafts the message in the chosen language", () => {
    expect(
      draftReviewNotice({ ...pull, event: "APPROVE" }, messagesFor("en"))
    ).toBe(
      "✅ I approved acme-api#9026 (round the shipping fees): @jdoe looks good to me, you can merge.\nhttps://github.com/acme/acme-api/pull/9026"
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
      "@jdoe merci",
      [{ login: "jdoe", name: "Jane Doe" }]
    )
    expect(prompt).toContain("in the channel #pull-requests")
    expect(prompt).toContain("- @jdoe (Jane Doe)")
    expect(prompt).toContain(JSON.stringify("@jdoe merci"))
  })
})
