import { DEFAULT_LANGUAGE } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"
import type { Messages } from "@/lib/i18n/messages"

export type StandupState = {
  status: "idle" | "running" | "done" | "error"
  /** Local day the last run belongs to. */
  date: string | null
  startedAt: string | null
  finishedAt: string | null
  /** The standup as written in the chat, with first names instead of Slack mentions. */
  message: string | null
  /** The same message with Slack mentions, as it will be posted. */
  slackMessage: string | null
  /** Today's "Daily standup reminder" thread, where the standup goes. */
  channelId: string | null
  threadTs: string | null
  /** A team standup was already in the thread when the command ran. */
  alreadyPosted: boolean
  postedAt: string | null
  postedLink: string | null
  note: string | null
  error: string | null
}

/** The team's standup, from the project board, and the viewer's own, from their PRs. */
export type StandupKind = "team" | "me"
export const STANDUP_KINDS: StandupKind[] = ["team", "me"]

/**
 * Why the standup cannot be published, or null when it can. Free of server
 * imports so the recap page can word it in the viewer's language.
 */
export function publishBlocker(
  state: StandupState,
  kind: StandupKind,
  t: Messages = messagesFor(DEFAULT_LANGUAGE)
): string | null {
  const { blockers, kinds } = t.recap.standup
  if (!state.slackMessage)
    return state.message ? blockers.outdated : blockers.nothing
  if (!state.channelId || !state.threadTs) return blockers.noThread
  if (state.postedAt) return blockers.alreadyPublished
  if (state.alreadyPosted) return kinds[kind].alreadyPosted
  return null
}
