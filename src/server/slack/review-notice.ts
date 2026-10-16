import type { SlackThreadRef } from "./reply"
import type { Messages } from "@/lib/i18n/messages"

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT"

/** A GitHub person the message pings, for the agent to find on Slack. */
export type NoticeMention = { login: string; name: string | null }

const WORDING = {
  APPROVE: "approve",
  REQUEST_CHANGES: "requestChanges",
  COMMENT: "comment",
} as const satisfies Record<ReviewEvent, string>

/**
 * The message offered with a review, pinging the author by handle. It is the
 * user's own message, so it starts in the app's language; they edit it before sending.
 * In the PR's own thread it is one short line; in the channel it names and links the PR.
 */
export function draftReviewNotice(
  input: {
    event: ReviewEvent
    repoFullName: string
    number: number
    url: string
    author: string | null
    inThread: boolean
  },
  t: Messages
): string {
  const m = t.server.reviewNotice
  const body = m[WORDING[input.event]]
  const who = input.author ? `@${input.author}` : null
  if (input.inThread) return m.inThread(who, body)
  const subject = `${input.repoFullName.split("/")[1]}#${input.number}`
  // A bare URL on its own line reads well in the box, and Slack links it.
  return `${m.inChannel(who, subject, body)}\n${input.url}`
}

/**
 * Posts the notice as the user. The message travels as a JSON string so the
 * agent sends it as written; the only change allowed is turning the listed
 * GitHub handles into Slack mentions.
 */
export function buildNoticePrompt(
  target: { thread: SlackThreadRef; broadcast: boolean } | { channel: string },
  message: string,
  mentions: NoticeMention[],
  tools: string[] = []
): string {
  return [
    "Post one Slack message on behalf of the user.",
    ...(tools.length
      ? [
          `Your Slack tools are ${tools.join(", ")}. If they are not loaded yet, load them first (for example with ToolSearch "select:${tools.join(",")}").`,
        ]
      : []),
    "thread" in target
      ? `Reply in the existing thread: channel_id "${target.thread.channelId}" and thread_ts "${target.thread.threadTs}". ${target.broadcast ? "Set reply_broadcast to true so that the reply also shows in the channel." : "Do not broadcast it to the channel."}`
      : `Post it as a new message in the channel #${target.channel.replace(/^#/, "")}: find the channel id with the channel search tool first.`,
    "The message is the JSON string below.",
    JSON.stringify(message),
    ...(mentions.length
      ? [
          "Before sending, turn each of these GitHub handles into a Slack mention <@USER_ID>, finding the person with the user search tool by their name or handle:",
          ...mentions.map(
            (mention) =>
              `- @${mention.login}${mention.name ? ` (${mention.name})` : ""}`
          ),
          "When you cannot find the person for sure, write their name in plain text instead of the handle.",
        ]
      : []),
    "Apart from those mentions, send the message exactly: do not translate, reword, shorten, sign or add anything. Send it once and do nothing else.",
    "Set sent to true only if the send tool succeeded, with the message's permalink when the tool returns one.",
  ].join("\n")
}
