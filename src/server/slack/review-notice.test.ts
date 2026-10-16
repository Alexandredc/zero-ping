import { describe, expect, it } from "vitest"
import { buildNoticePrompt, draftReviewNotice } from "./review-notice"
import { messagesFor } from "@/lib/i18n/messages"

const fr = messagesFor("fr")

const pull = {
  repoFullName: "acme/acme-api",
  number: 9026,
  url: "https://github.com/acme/acme-api/pull/9026",
  author: "jdoe",
  inThread: false,
}

describe("draftReviewNotice", () => {
  it("names and links the PR in the channel, pinging its author", () => {
    expect(draftReviewNotice({ ...pull, event: "APPROVE" }, fr)).toBe(
      "@jdoe j'ai regardé ta PR acme-api#9026, c'est tout bon pour moi, tu peux merger ✅\nhttps://github.com/acme/acme-api/pull/9026"
    )
  })

  it("keeps to one short line in the PR's thread", () => {
    expect(
      draftReviewNotice(
        { ...pull, event: "REQUEST_CHANGES", inThread: true },
        fr
      )
    ).toBe("@jdoe je t'ai laissé quelques retours avant de merger 🔁")
  })

  it("reads without an author to ping", () => {
    expect(
      draftReviewNotice(
        { ...pull, event: "COMMENT", author: null, inThread: true },
        fr
      )
    ).toBe("Je t'ai laissé quelques commentaires 💬")
    expect(
      draftReviewNotice({ ...pull, event: "APPROVE", author: null }, fr)
    ).toMatch(/^J'ai regardé acme-api#9026, c'est tout bon/)
  })

  it("drafts the message in the chosen language", () => {
    expect(
      draftReviewNotice({ ...pull, event: "APPROVE" }, messagesFor("en"))
    ).toBe(
      "@jdoe I looked at your PR acme-api#9026, all good for me, you can merge ✅\nhttps://github.com/acme/acme-api/pull/9026"
    )
  })
})

describe("buildNoticePrompt", () => {
  it("replies in the PR's thread when there is one", () => {
    const prompt = buildNoticePrompt(
      { thread: { channelId: "C1", threadTs: "1.2" }, broadcast: false },
      "Salut",
      []
    )
    expect(prompt).toContain('channel_id "C1" and thread_ts "1.2"')
    expect(prompt).toContain("Do not broadcast")
    expect(prompt).not.toContain("Slack mention")
  })

  it("also shows the thread reply in the channel when asked", () => {
    const prompt = buildNoticePrompt(
      { thread: { channelId: "C1", threadTs: "1.2" }, broadcast: true },
      "Salut",
      []
    )
    expect(prompt).toContain("reply_broadcast to true")
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
