import { z } from "zod"
import type {
  Item,
  SlackDiscussion,
  SummaryContent,
  SummaryLength,
} from "@/server/db/schema"
import type {
  Conversation,
  ConversationComment,
} from "@/server/github/conversation"

/** Summaries always use Claude Code; Sonnet balances quality and speed. */
export const DEFAULT_SUMMARY_MODEL = "sonnet"

/** Keeps the agent input bounded on very long conversations. */
const MAX_INPUT_CHARS = 120_000

const summarySchema = z.strictObject({
  tldr: z
    .string()
    .describe("Two or three sentences: what this is about and why it matters."),
  status: z
    .string()
    .describe("Where things stand now: decisions made, what is blocked."),
  expectedFromMe: z
    .string()
    .describe(
      "What the reader is expected to do next, or an empty string if nothing."
    ),
  openQuestions: z.array(z.string()).describe("Questions still unanswered."),
  risks: z.array(z.string()).describe("Risks or concerns raised, if any."),
})

export const SUMMARY_JSON_SCHEMA = z.toJSONSchema(summarySchema, {
  target: "draft-7",
}) as Record<string, unknown>

function formatComment(comment: ConversationComment, label = ""): string {
  const author = comment.author ?? "ghost"
  return `[${comment.createdAt}] ${author}${label ? ` (${label})` : ""}:\n${comment.body.trim()}`
}

/** Plain-text transcript of the GitHub conversation and its Slack threads. */
export function buildSummaryInput(
  item: Item,
  conversation: Conversation | null,
  slack: SlackDiscussion[]
): string {
  const lines = [
    `# ${item.kind === "PullRequest" ? "Pull request" : "Issue"} ${item.repoFullName}#${item.number ?? ""}: ${item.title}`,
    `State: ${conversation?.state ?? item.state ?? "unknown"}`,
    ...(item.labels.length ? [`Labels: ${item.labels.join(", ")}`] : []),
    ...(item.additions !== null
      ? [`Size: +${item.additions} -${item.deletions ?? 0} lines`]
      : []),
    ...(item.ciState ? [`CI: ${item.ciState}`] : []),
    "",
  ]
  if (conversation) {
    lines.push(
      "## GitHub conversation",
      formatComment(conversation.description, "description")
    )
    for (const entry of conversation.entries) {
      if (entry.type === "thread") {
        lines.push(
          `--- Review thread on ${entry.path}${entry.line === null ? "" : `:${entry.line}`}${entry.isResolved ? " (resolved)" : ""}`,
          ...entry.comments.map((comment) => formatComment(comment)),
          "---"
        )
      } else {
        lines.push(
          formatComment(
            entry,
            entry.type === "review" ? `review ${entry.state}` : ""
          )
        )
      }
    }
  }
  for (const discussion of slack) {
    lines.push(
      "",
      `## Slack thread in ${discussion.channel}`,
      ...discussion.messages.map(
        (m) => `[${m.postedAt}] ${m.author}:\n${m.text}`
      )
    )
  }
  const text = lines.join("\n\n")
  return text.length > MAX_INPUT_CHARS
    ? `${text.slice(0, MAX_INPUT_CHARS)}\n\n[Conversation truncated]`
    : text
}

/** Length rules: the same fields, with a tighter budget for each mode. */
const LENGTH_RULES: Record<SummaryLength, string[]> = {
  short: [
    "Length: SHORT. The whole summary must be readable in 15 seconds.",
    "tldr: one sentence of at most 25 words. status: one sentence. expectedFromMe: one short sentence or empty.",
    "openQuestions and risks: at most 2 items each, a few words per item, only the ones that matter. No lists or line breaks inside fields.",
  ],
  standard: [
    "Length: STANDARD. Readable in under a minute.",
    "tldr: at most 2 sentences. status: at most 4 short bullet points. expectedFromMe: one or two sentences or empty.",
    "openQuestions and risks: at most 3 items each, one line per item.",
  ],
  detailed: [
    "Length: DETAILED. Cover every decision, disagreement and pending point, with who said what.",
    "status may use bullet points. List every open question and risk raised.",
  ],
}

export function buildSummaryPrompt(
  readerLogin: string,
  length: SummaryLength = "detailed"
): string {
  return [
    `Summarise the GitHub conversation given on stdin for ${readerLogin}, a lead developer who has not read it.`,
    "Write in French, plainly. Name people with their handle.",
    ...LENGTH_RULES[length],
    `In expectedFromMe, say what ${readerLogin} is expected to do (review, answer someone, decide…), or leave it empty.`,
    "Only use what the conversation says: do not invent facts. Do not use any tool.",
  ].join("\n")
}

export function parseSummary(answer: unknown): SummaryContent {
  return summarySchema.parse(answer)
}
