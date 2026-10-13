import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { eq } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { getAgentConfig, runAgent } from "@/server/agents/runner"
import type { AgentConfig } from "@/server/agents/runner"
import { getPreferences } from "@/server/preferences"
import type { Preferences } from "@/server/preferences"
import { recordAttention } from "@/server/inbox/attention"
import { getMessages } from "@/server/i18n"
import { LANGUAGE_PROMPT_NAMES } from "@/lib/i18n/core"
import type { Language } from "@/lib/i18n/core"
import type { Messages } from "@/lib/i18n/messages"
import { publishBlocker } from "./standup-state"
import type { StandupKind, StandupState } from "./standup-state"
import {
  REPLY_JSON_SCHEMA,
  buildReplyPrompt,
  parseReply,
  slackSendTools,
} from "@/server/slack/reply"

export { STANDUP_KINDS, publishBlocker } from "./standup-state"
export type { StandupKind, StandupState } from "./standup-state"

const EMPTY: StandupState = {
  status: "idle",
  date: null,
  startedAt: null,
  finishedAt: null,
  message: null,
  slackMessage: null,
  channelId: null,
  threadTs: null,
  alreadyPosted: false,
  postedAt: null,
  postedLink: null,
  note: null,
  error: null,
}

const nullableText = (description: string) => ({
  type: ["string", "null"],
  description,
})

export const standupJsonSchema = (kind: StandupKind, language: Language) => ({
  type: "object",
  additionalProperties: false,
  required: [
    "message",
    "slackMessage",
    "channelId",
    "threadTs",
    "alreadyPosted",
    "note",
  ],
  properties: {
    message: {
      type: "string",
      description:
        "The standup message exactly as shown in the chat (Markdown, first names in bold), or an empty string if none was written.",
    },
    slackMessage: nullableText(
      "The same message as it would go to Slack, with the <@SlackID> mentions, or null."
    ),
    channelId: nullableText(
      "The channel of today's Daily standup reminder, or null when there is none."
    ),
    threadTs: nullableText(
      "The Message TS of today's Daily standup reminder, or null when there is none."
    ),
    alreadyPosted: {
      type: "boolean",
      description:
        kind === "team"
          ? "True when a team standup is already in today's reminder thread."
          : "True when the user already posted their own standup in today's reminder thread.",
    },
    note: nullableText(
      `In ${LANGUAGE_PROMPT_NAMES[language]}, one sentence for anything the user must know: no reminder today, standup already posted, unknown names. Null otherwise.`
    ),
  },
})

const UNATTENDED =
  "You run unattended inside Zéro Ping, a local app: nobody can answer questions, so never ask any and follow the command to the end."

const SLACK_READ_TOOLS = [
  "mcp__claude_ai_Slack__slack_read_channel",
  "mcp__claude_ai_Slack__slack_read_thread",
  "mcp__claude_ai_Slack__slack_search_users",
]

const KIND_CONFIG: Record<
  StandupKind,
  {
    /** Settings row holding the last run. */
    key: string
    timeoutMs: number
  }
> = {
  team: {
    key: "standup",
    // The board export alone takes about six minutes.
    timeoutMs: 25 * 60_000,
  },
  me: {
    key: "standup:me",
    timeoutMs: 10 * 60_000,
  },
}

export type StandupSettings = Pick<
  Preferences,
  | "standupChannel"
  | "standupReminder"
  | "teamStandupCommand"
  | "myStandupCommand"
>

/** The command that writes the standup, as the settings name it. */
export function standupCommand(
  kind: StandupKind,
  settings: StandupSettings
): string {
  return kind === "team"
    ? settings.teamStandupCommand
    : settings.myStandupCommand
}

/** What the agent must do around the command: find the reminder's thread, draft nothing. */
export function standupSystemPrompt(
  kind: StandupKind,
  settings: StandupSettings
): string {
  const reminder = `today's ${JSON.stringify(settings.standupReminder)} message in #${settings.standupChannel}`
  return [
    UNATTENDED,
    `Do not create any Slack draft or post anything. Instead, find ${reminder} (look the channel up with the channel search tool when you need its id), read its thread, and tell whether ${kind === "team" ? "a team standup" : "the user's own standup"} is already there. Zéro Ping shows the standup to the user and posts it in that thread when they click to publish.`,
    kind === "team"
      ? "Your final structured answer reports the standup message in both forms, the reminder thread and any note for the user."
      : "Your final structured answer reports the standup message (Markdown for the chat, Slack mrkdwn for Slack), the reminder thread and any note for the user.",
  ].join(" ")
}

/** Why a standup cannot run yet, or null when it can. */
export function standupSetupBlocker(
  settings: StandupSettings,
  t: Messages
): string | null {
  return settings.standupChannel ? null : t.recap.standup.setupChannel
}

const globalForStandup = globalThis as unknown as {
  __zeroPingStandups?: Partial<Record<StandupKind, Promise<void>>>
}
const runs = (globalForStandup.__zeroPingStandups ??= {})

export async function readStandup(
  db: Database,
  kind: StandupKind
): Promise<StandupState> {
  const row = (
    await db
      .select()
      .from(settings)
      .where(eq(settings.key, KIND_CONFIG[kind].key))
  ).at(0)
  const state = {
    ...EMPTY,
    ...(row?.value as Partial<StandupState> | undefined),
  }
  // A run cut short by a server restart would otherwise spin forever.
  if (state.status === "running" && !runs[kind])
    return {
      ...state,
      status: "error",
      error: (await getMessages(db)).t.recap.standup.interrupted,
    }
  return state
}

async function writeStandup(
  db: Database,
  kind: StandupKind,
  state: StandupState
) {
  await db
    .insert(settings)
    .values({ key: KIND_CONFIG[kind].key, value: state })
    .onConflictDoUpdate({ target: settings.key, set: { value: state } })
}

export type StandupResult = Pick<
  StandupState,
  | "message"
  | "slackMessage"
  | "channelId"
  | "threadTs"
  | "alreadyPosted"
  | "note"
>

export function parseStandup(answer: unknown, t: Messages): StandupResult {
  const value = answer as Record<string, unknown> | null
  if (!value || typeof value.message !== "string")
    throw new Error(t.recap.standup.noMessage)
  const text = (field: unknown) =>
    typeof field === "string" && field.trim() ? field.trim() : null
  return {
    message: value.message.trim(),
    slackMessage: text(value.slackMessage),
    channelId: text(value.channelId),
    threadTs: text(value.threadTs),
    alreadyPosted: value.alreadyPosted === true,
    note: text(value.note),
  }
}

/** The instructions of a Claude Code command, without its frontmatter, for an agent that has no slash commands. */
export function commandInstructions(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replaceAll("$ARGUMENTS", "")
    .trim()
}

/** Claude Code runs the slash command; Codex reads the same command's file. */
async function standupPrompt(agent: AgentConfig, command: string, t: Messages) {
  if (agent.kind === "claude") return command
  const file = path.join(
    homedir(),
    ".claude",
    "commands",
    `${command.replace(/^\//, "").replace(":", "/")}.md`
  )
  try {
    return commandInstructions(await readFile(file, "utf8"))
  } catch {
    throw new Error(t.recap.standup.codexCommandMissing(command, file))
  }
}

/** Posts the standup in today's reminder thread, as the user. */
export async function publishStandup(
  db: Database,
  kind: StandupKind
): Promise<StandupState> {
  const [state, { t }] = await Promise.all([
    readStandup(db, kind),
    getMessages(db),
  ])
  const blocker = publishBlocker(state, kind, t)
  if (blocker) throw new Error(blocker)
  const config = getAgentConfig(process.env, await getPreferences(db))
  const tools = slackSendTools(config.kind)
  const answer = await runAgent(
    {
      prompt: buildReplyPrompt(
        { channelId: state.channelId!, threadTs: state.threadTs! },
        state.slackMessage!,
        tools
      ),
      schema: REPLY_JSON_SCHEMA,
      allowedTools: tools,
      timeoutMs: 90_000,
    },
    config
  )
  const { permalink } = parseReply(answer, t)
  const next = {
    ...state,
    postedAt: new Date().toISOString(),
    postedLink: permalink,
  }
  await writeStandup(db, kind, next)
  return next
}

/** Starts a standup in the background, or joins the run in progress. */
export function startStandup(
  db: Database,
  date: string,
  kind: StandupKind
): Promise<void> {
  const config = KIND_CONFIG[kind]
  runs[kind] ??= (async () => {
    const startedAt = new Date().toISOString()
    const [preferences, { t, language }] = await Promise.all([
      getPreferences(db),
      getMessages(db),
    ])
    const blocker = standupSetupBlocker(preferences, t)
    if (blocker) {
      await writeStandup(db, kind, {
        ...(await readStandup(db, kind)),
        status: "error",
        date,
        startedAt,
        finishedAt: startedAt,
        error: blocker,
      })
      return
    }
    await writeStandup(db, kind, {
      ...(await readStandup(db, kind)),
      status: "running",
      date,
      startedAt,
      finishedAt: null,
      error: null,
    })
    try {
      // The command needs the user's default model, gh, jq and the Slack connector.
      const agent: AgentConfig = {
        ...getAgentConfig(process.env, preferences),
        model: undefined,
      }
      const answer = await runAgent(
        {
          prompt: await standupPrompt(
            agent,
            standupCommand(kind, preferences),
            t
          ),
          appendSystemPrompt: standupSystemPrompt(kind, preferences),
          schema: standupJsonSchema(kind, language),
          allowedTools: ["Bash", "Read", "Write", ...SLACK_READ_TOOLS],
          sandbox: "workspace-write",
          timeoutMs: config.timeoutMs,
        },
        agent
      )
      const result = parseStandup(answer, t)
      await writeStandup(db, kind, {
        status: "done",
        date,
        startedAt,
        finishedAt: new Date().toISOString(),
        ...result,
        postedAt: null,
        postedLink: null,
        error: null,
      })
      await recordAttention(db, [
        {
          itemKey: kind === "team" ? "standup" : "standup:me",
          kind: "recap",
          title: t.recap.standup.kinds[kind].readyTitle,
          body: result.note ?? t.recap.standup.readyBody,
        },
      ])
    } catch (error) {
      await writeStandup(db, kind, {
        ...(await readStandup(db, kind)),
        status: "error",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })().finally(() => {
    runs[kind] = undefined
  })
  return runs[kind]
}
