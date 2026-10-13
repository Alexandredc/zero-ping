import { z } from "zod"
import type { ChatMessage } from "@/server/db/schema"
import type { PullFile } from "@/server/github/pull-files"

/** The diff Claude reads for a question on a PR, cut to keep the prompt fast. */
const MAX_DIFF_CHARS = 60_000
/** Earlier exchanges kept in the prompt, so follow-up questions make sense. */
const MAX_HISTORY = 10

export const CHAT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: {
    answer: {
      type: "string",
      description: "The answer, in French Markdown.",
    },
  },
}

export function buildChatPrompt(readerLogin: string): string {
  return [
    `Answer the question of ${readerLogin}, a lead developer, about the GitHub item given on stdin.`,
    "The input holds the item, its GitHub conversation, the Slack threads found about it, the diff for a pull request, then the earlier exchanges and the question.",
    "Write in French, plainly and briefly; use Markdown and code references (file:line) when they help. Name people with their handle.",
    "Only use what the input says. When it does not hold the answer, say so instead of guessing. Do not use any tool.",
  ].join("\n")
}

/** The patches of a PR's files, in order, until the size budget runs out. */
export function formatDiff(files: PullFile[], max = MAX_DIFF_CHARS): string {
  const parts: string[] = []
  let size = 0
  let skipped = 0
  for (const file of files) {
    const block = `--- ${file.filename} (+${file.additions} -${file.deletions})\n${file.patch ?? "(binary or too large to show)"}`
    if (size + block.length > max) {
      skipped += 1
      continue
    }
    parts.push(block)
    size += block.length
  }
  if (skipped > 0)
    parts.push(
      `(${skipped} more file${skipped > 1 ? "s" : ""} left out for size)`
    )
  return parts.join("\n")
}

export function buildChatInput(
  context: string,
  diff: string | null,
  history: ChatMessage[],
  question: string
): string {
  const lines = [context]
  if (diff) lines.push("", "## Diff", diff)
  const earlier = history.slice(-MAX_HISTORY)
  if (earlier.length > 0)
    lines.push(
      "",
      "## Earlier exchanges",
      ...earlier.map(
        (message) =>
          `${message.role === "user" ? "Question" : "Answer"}: ${message.content}`
      )
    )
  lines.push("", "## Question", question)
  return lines.join("\n")
}

export function parseChatAnswer(answer: unknown): string {
  return z
    .object({ answer: z.string().min(1) })
    .parse(answer)
    .answer.trim()
}
