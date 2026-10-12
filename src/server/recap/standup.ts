import { eq } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { getAgentConfig, runAgent } from "@/server/agents/runner"
import { recordAttention } from "@/server/inbox/attention"
import {
  REPLY_JSON_SCHEMA,
  buildReplyPrompt,
  parseReply,
  slackSendTools,
} from "@/server/slack/reply"

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

const KEY = "standup"
/** The board export alone takes about six minutes. */
const TIMEOUT_MS = 25 * 60_000

export const STANDUP_COMMAND = "/standup:team"

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

export const STANDUP_JSON_SCHEMA = {
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
        "True when a team standup is already in today's reminder thread.",
    },
    note: nullableText(
      "In French, one sentence for anything the user must know: no reminder today, standup already posted, unknown names. Null otherwise."
    ),
  },
}

const SYSTEM_PROMPT = [
  "You run unattended inside Zéro Ping, a local app: nobody can answer questions, so never ask any and follow the command to the end.",
  "Override for step 5: find today's reminder and read its thread (steps 5.1 and 5.2), but do not create the Slack draft. Zéro Ping shows the standup to the user and posts it in that thread when they click to publish.",
  "Your final structured answer reports the standup message in both forms, the reminder thread and any note for the user.",
].join(" ")

const globalForStandup = globalThis as unknown as {
  __zeroPingStandup?: Promise<void>
}

export async function readStandup(db: Database): Promise<StandupState> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, KEY))
  ).at(0)
  const state = {
    ...EMPTY,
    ...(row?.value as Partial<StandupState> | undefined),
  }
  // A run cut short by a server restart would otherwise spin forever.
  if (state.status === "running" && !globalForStandup.__zeroPingStandup)
    return {
      ...state,
      status: "error",
      error: "Interrompu par un redémarrage de l'app.",
    }
  return state
}

async function writeStandup(db: Database, state: StandupState) {
  await db
    .insert(settings)
    .values({ key: KEY, value: state })
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

export function parseStandup(answer: unknown): StandupResult {
  const value = answer as Record<string, unknown> | null
  if (!value || typeof value.message !== "string")
    throw new Error("Le standup n'a pas renvoyé de message.")
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

/** Why the standup cannot be published, or null when it can. */
export function publishBlocker(state: StandupState): string | null {
  if (!state.slackMessage)
    return state.message
      ? "Ce standup date d'avant le bouton : relance-le pour préparer sa version Slack."
      : "Aucun standup à publier."
  if (!state.channelId || !state.threadTs)
    return "Pas de « Daily standup reminder » aujourd'hui : rien où publier."
  if (state.postedAt) return "Ce standup est déjà publié."
  if (state.alreadyPosted)
    return "Un point d'équipe est déjà dans le fil d'aujourd'hui."
  return null
}

/** Posts the standup in today's reminder thread, as the user. */
export async function publishStandup(db: Database): Promise<StandupState> {
  const state = await readStandup(db)
  const blocker = publishBlocker(state)
  if (blocker) throw new Error(blocker)
  const config = getAgentConfig(process.env, { agentCli: "claude" })
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
  const { permalink } = parseReply(answer)
  const next = {
    ...state,
    postedAt: new Date().toISOString(),
    postedLink: permalink,
  }
  await writeStandup(db, next)
  return next
}

/** Starts the team standup in the background, or joins the run in progress. */
export function startStandup(db: Database, date: string): Promise<void> {
  globalForStandup.__zeroPingStandup ??= (async () => {
    const startedAt = new Date().toISOString()
    await writeStandup(db, {
      ...(await readStandup(db)),
      status: "running",
      date,
      startedAt,
      finishedAt: null,
      error: null,
    })
    try {
      // The command needs the user's default model, gh, jq and the Slack connector.
      const config = {
        ...getAgentConfig(process.env, { agentCli: "claude" }),
        model: undefined,
      }
      const answer = await runAgent(
        {
          prompt: STANDUP_COMMAND,
          appendSystemPrompt: SYSTEM_PROMPT,
          schema: STANDUP_JSON_SCHEMA,
          allowedTools: [
            "Bash",
            "Read",
            "Write",
            "mcp__claude_ai_Slack__slack_read_channel",
            "mcp__claude_ai_Slack__slack_read_thread",
            "mcp__claude_ai_Slack__slack_search_users",
          ],
          timeoutMs: TIMEOUT_MS,
        },
        config
      )
      const result = parseStandup(answer)
      await writeStandup(db, {
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
          itemKey: "standup",
          kind: "recap",
          title: "Standup prêt",
          body:
            result.note ??
            "Relis-le dans le récap du jour, puis publie-le dans Slack.",
        },
      ])
    } catch (error) {
      await writeStandup(db, {
        ...(await readStandup(db)),
        status: "error",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })().finally(() => {
    globalForStandup.__zeroPingStandup = undefined
  })
  return globalForStandup.__zeroPingStandup
}
