import { z } from "zod"
import type { AgentKind } from "@/server/agents/runner"
import type { SlackDiscussion } from "@/server/db/schema"
import type { Messages } from "@/lib/i18n/messages"

export type SlackSubject = {
  repoFullName: string
  number: number
  title: string
  htmlUrl: string
  kind?: "PullRequest" | "Issue"
}

const discussionsSchema = z.strictObject({
  searched: z
    .boolean()
    .describe("True only if a Slack search tool actually ran."),
  discussions: z.array(
    z.strictObject({
      channel: z.string(),
      permalink: z.string(),
      match: z.enum(["link", "reference", "title"]),
      messages: z.array(
        z.strictObject({
          author: z.string(),
          text: z.string(),
          postedAt: z.string(),
        })
      ),
    })
  ),
})

export const DISCUSSIONS_JSON_SCHEMA = z.toJSONSchema(discussionsSchema, {
  target: "draft-7",
}) as Record<string, unknown>

/** Claude Code tool names of the claude.ai Slack connector. */
const CLAUDE_SLACK_TOOLS = [
  "mcp__claude_ai_Slack__slack_search_public_and_private",
  "mcp__claude_ai_Slack__slack_read_thread",
]

/**
 * Tools the agent may use. SLACK_AGENT_TOOLS overrides the defaults, for a
 * different Slack MCP server. Codex ignores the list and relies on its config.
 */
export function slackTools(
  kind: AgentKind,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (env.SLACK_AGENT_TOOLS)
    return env.SLACK_AGENT_TOOLS.split(/[\s,]+/).filter(Boolean)
  return kind === "claude" ? CLAUDE_SLACK_TOOLS : []
}

export function buildSlackPrompt(
  subject: SlackSubject,
  tools: string[] = [],
  excludedChannels: string[] = []
): string {
  const repoName = subject.repoFullName.split("/")[1]
  const isIssue = subject.kind === "Issue"
  const noun = isIssue ? "issue" : "pull request"
  const path = `${repoName}/${isIssue ? "issues" : "pull"}/${subject.number}`
  return [
    `Find Slack discussions about the GitHub ${noun} ${subject.htmlUrl}`,
    `(repository ${subject.repoFullName}, number ${subject.number}, title "${subject.title}").`,
    "",
    ...(tools.length
      ? [
          `Your Slack tools are ${tools.join(" and ")}. If they are not loaded yet, load them first (for example with ToolSearch "select:${tools.join(",")}").`,
        ]
      : []),
    "Use your Slack tools to search three ways:",
    `1. Messages containing "${path}" or the full URL. Mark them match "link".`,
    `2. Messages mentioning "${repoName}#${subject.number}" or "#${subject.number}" alongside the repository. Mark them match "reference".`,
    `3. Messages discussing the title. Mark them match "title", and only keep them when they are clearly about this ${noun}.`,
    "",
    ...(excludedChannels.length
      ? [
          `Ignore these channels entirely, matched by name or by channel ID (the ID is in the permalink, after /archives/): ${excludedChannels.join(", ")}.`,
        ]
      : []),
    "For every matching message, read its thread and return the whole conversation, root message first.",
    "Return each thread once, with its channel name (with #) and its Slack permalink.",
    'Name a direct message "#dm <other participant\'s name>", always the same way.',
    "Keep message text verbatim in Slack mrkdwn and postedAt in ISO 8601.",
    "Set searched to true only if a Slack search tool actually ran; if you have no Slack access, set it to false.",
    "Return an empty list when nothing matches. Read only: never post, react or edit anything.",
  ].join("\n")
}

export function parseDiscussions(
  answer: unknown,
  t: Messages
): SlackDiscussion[] {
  const { searched, discussions } = discussionsSchema.parse(answer)
  if (!searched) throw new Error(t.server.errors.slackUnavailable)
  const seen = new Set<string>()
  return discussions.filter((discussion) => {
    if (seen.has(discussion.permalink)) return false
    seen.add(discussion.permalink)
    return discussion.messages.length > 0
  })
}
