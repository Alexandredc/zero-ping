import { describe, expect, it } from "vitest"
import { messagesFor } from "@/lib/i18n/messages"
import {
  buildReplyPrompt,
  parsePermalink,
  parseReply,
  slackSendTools,
} from "./reply"

describe("parsePermalink", () => {
  it("reads the channel and the root message timestamp", () => {
    expect(
      parsePermalink(
        "https://acme.slack.com/archives/C01ABCD2EFG/p1791445131867549"
      )
    ).toEqual({ channelId: "C01ABCD2EFG", threadTs: "1791445131.867549" })
  })

  it("prefers the thread timestamp of a reply link", () => {
    expect(
      parsePermalink(
        "https://acme.slack.com/archives/C1/p1791445200000100?thread_ts=1791445131.867549&cid=C1"
      )
    ).toEqual({ channelId: "C1", threadTs: "1791445131.867549" })
  })

  it("rejects links that are not message permalinks", () => {
    expect(parsePermalink("https://acme.slack.com/archives/C1")).toBeNull()
    expect(parsePermalink("not a url")).toBeNull()
  })
})

describe("buildReplyPrompt", () => {
  it("passes the message as an exact JSON string with the thread target", () => {
    const message = 'LGTM, merge "quand tu veux"\n- ok'
    const prompt = buildReplyPrompt(
      { channelId: "C1", threadTs: "1.2" },
      message,
      slackSendTools("claude", {})
    )
    expect(prompt).toContain(JSON.stringify(message))
    expect(prompt).toContain('channel_id "C1" and thread_ts "1.2"')
    expect(prompt).toContain("select:mcp__claude_ai_Slack__slack_send_message")
  })
})

describe("parseReply", () => {
  it("requires a confirmed send", () => {
    const fr = messagesFor("fr")
    expect(parseReply({ sent: true, permalink: "" }, fr)).toEqual({
      permalink: null,
    })
    expect(() => parseReply({ sent: false, permalink: "" }, fr)).toThrow(
      "pas confirmé"
    )
    expect(() =>
      parseReply({ sent: false, permalink: "" }, messagesFor("en"))
    ).toThrow("Slack did not confirm the message was sent.")
  })
})

describe("slackSendTools", () => {
  it("uses the claude.ai connector for Claude Code and the config for Codex", () => {
    expect(slackSendTools("claude", {})).toEqual([
      "mcp__claude_ai_Slack__slack_send_message",
    ])
    expect(slackSendTools("codex", {})).toEqual([])
    expect(
      slackSendTools("claude", { SLACK_AGENT_SEND_TOOL: "mcp__slack__post" })
    ).toEqual(["mcp__slack__post"])
  })
})
