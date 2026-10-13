import { z } from "zod"
import type { AgentKind } from "@/server/agents/runner"
import type { Messages } from "@/lib/i18n/messages"

export type SlackThreadRef = { channelId: string; threadTs: string }

/**
 * Reads the channel and thread timestamp from a Slack permalink such as
 * https://acme.slack.com/archives/C01ABCD2EFG/p1791445131867549, or a reply
 * link carrying `?thread_ts=`.
 */
export function parsePermalink(permalink: string): SlackThreadRef | null {
  let url: URL
  try {
    url = new URL(permalink)
  } catch {
    return null
  }
  const match = url.pathname.match(/\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})$/)
  if (!match) return null
  return {
    channelId: match[1],
    threadTs: url.searchParams.get("thread_ts") ?? `${match[2]}.${match[3]}`,
  }
}

const replySchema = z.strictObject({
  sent: z.boolean().describe("True only if the send tool succeeded."),
  permalink: z
    .string()
    .describe("Link to the posted reply, or an empty string."),
})

export const REPLY_JSON_SCHEMA = z.toJSONSchema(replySchema, {
  target: "draft-7",
}) as Record<string, unknown>

/** Claude Code tool name of the claude.ai Slack connector's send action. */
const CLAUDE_SEND_TOOL = "mcp__claude_ai_Slack__slack_send_message"

export function slackSendTools(
  kind: AgentKind,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (env.SLACK_AGENT_SEND_TOOL) return [env.SLACK_AGENT_SEND_TOOL]
  return kind === "claude" ? [CLAUDE_SEND_TOOL] : []
}

/**
 * The message travels as a JSON string so the agent copies it exactly instead
 * of rewording it.
 */
export function buildReplyPrompt(
  thread: SlackThreadRef,
  message: string,
  tools: string[] = []
): string {
  return [
    "Post one reply in an existing Slack thread on behalf of the user.",
    ...(tools.length
      ? [
          `Use ${tools.join(" or ")}. If it is not loaded yet, load it first (for example with ToolSearch "select:${tools.join(",")}").`,
        ]
      : ["Use your Slack tool that sends messages."]),
    `Call it exactly once with channel_id "${thread.channelId}" and thread_ts "${thread.threadTs}".`,
    "The message is the JSON string below. Send its decoded value exactly: do not translate, reword, shorten, sign or add anything.",
    JSON.stringify(message),
    "Do not broadcast the reply to the channel and do nothing else.",
    "Set sent to true only if the tool succeeded, with the reply's permalink when the tool returns one.",
  ].join("\n")
}

export function parseReply(
  answer: unknown,
  t: Messages
): { permalink: string | null } {
  const { sent, permalink } = replySchema.parse(answer)
  if (!sent) throw new Error(t.server.errors.slackNotConfirmed)
  return { permalink: permalink || null }
}
