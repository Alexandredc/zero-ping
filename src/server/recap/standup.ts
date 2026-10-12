import { eq } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { getAgentConfig, runAgent } from "@/server/agents/runner"
import { recordAttention } from "@/server/inbox/attention"

export type StandupState = {
  status: "idle" | "running" | "done" | "error"
  /** Local day the last run belongs to. */
  date: string | null
  startedAt: string | null
  finishedAt: string | null
  /** The standup as written in the chat, with first names instead of Slack mentions. */
  message: string | null
  draftLink: string | null
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
  draftLink: null,
  note: null,
  error: null,
}

export const STANDUP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["message", "draftLink", "note"],
  properties: {
    message: {
      type: "string",
      description:
        "The standup message exactly as shown in the chat (Markdown, first names in bold), or an empty string if none was written.",
    },
    draftLink: {
      type: ["string", "null"],
      description:
        "The channel_link returned when the Slack draft was created, or null when no draft was created.",
    },
    note: {
      type: ["string", "null"],
      description:
        "In French, one sentence for anything the user must know: no reminder today, draft already exists, standup already posted, unknown names. Null otherwise.",
    },
  },
}

const SYSTEM_PROMPT = `You run unattended inside Zéro Ping, a local app: nobody can answer questions, so never ask any and follow the command to the end. Your final structured answer reports the standup message, the Slack draft link and any note for the user.`

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

export function parseStandup(answer: unknown): {
  message: string
  draftLink: string | null
  note: string | null
} {
  const value = answer as Record<string, unknown> | null
  if (!value || typeof value.message !== "string")
    throw new Error("Le standup n'a pas renvoyé de message.")
  const text = (field: unknown) =>
    typeof field === "string" && field.trim() ? field.trim() : null
  return {
    message: value.message.trim(),
    draftLink: text(value.draftLink),
    note: text(value.note),
  }
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
            "mcp__claude_ai_Slack__slack_send_message_draft",
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
        error: null,
      })
      await recordAttention(db, [
        {
          itemKey: "standup",
          kind: "recap",
          title: result.draftLink
            ? "Standup prêt en brouillon dans Slack"
            : "Standup prêt",
          body: result.note ?? "Relis-le et envoie-le depuis Slack.",
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
