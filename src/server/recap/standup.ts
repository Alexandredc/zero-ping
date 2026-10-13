import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { eq } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { settings } from "@/server/db/schema"
import { getAgentConfig, runAgent } from "@/server/agents/runner"
import type { AgentConfig } from "@/server/agents/runner"
import { getPreferences } from "@/server/preferences"
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

/** The team's standup, from the project board, and the viewer's own, from their PRs. */
export type StandupKind = "team" | "me"
export const STANDUP_KINDS: StandupKind[] = ["team", "me"]

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

export const standupJsonSchema = (kind: StandupKind) => ({
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
      "In French, one sentence for anything the user must know: no reminder today, standup already posted, unknown names. Null otherwise."
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
    command: string
    systemPrompt: string
    timeoutMs: number
    readyTitle: string
    alreadyPosted: string
  }
> = {
  team: {
    key: "standup",
    command: "/standup:team",
    systemPrompt: [
      UNATTENDED,
      "Override for step 5: find today's reminder and read its thread (steps 5.1 and 5.2), but do not create the Slack draft. Zéro Ping shows the standup to the user and posts it in that thread when they click to publish.",
      "Your final structured answer reports the standup message in both forms, the reminder thread and any note for the user.",
    ].join(" "),
    // The board export alone takes about six minutes.
    timeoutMs: 25 * 60_000,
    readyTitle: "Standup d'équipe prêt",
    alreadyPosted: "Un point d'équipe est déjà dans le fil d'aujourd'hui.",
  },
  me: {
    key: "standup:me",
    command: "/standup",
    systemPrompt: [
      UNATTENDED,
      'Override for the Slack draft: do not create it. Instead, find today\'s "Daily standup reminder" message in #tech-team-general (channel C08P7R8BLCA) with slack_read_channel, read its thread with slack_read_thread, and tell whether the user already posted their own standup there. Zéro Ping shows the standup to the user and posts it in that thread when they click to publish.',
      "Your final structured answer reports the standup message (Markdown for the chat, Slack mrkdwn for Slack), the reminder thread and any note for the user.",
    ].join(" "),
    timeoutMs: 10 * 60_000,
    readyTitle: "Ton standup est prêt",
    alreadyPosted: "Ton standup est déjà dans le fil d'aujourd'hui.",
  },
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
      error: "Interrompu par un redémarrage de l'app.",
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
export function publishBlocker(
  state: StandupState,
  kind: StandupKind
): string | null {
  if (!state.slackMessage)
    return state.message
      ? "Ce standup date d'avant le bouton : relance-le pour préparer sa version Slack."
      : "Aucun standup à publier."
  if (!state.channelId || !state.threadTs)
    return "Pas de « Daily standup reminder » aujourd'hui : rien où publier."
  if (state.postedAt) return "Ce standup est déjà publié."
  if (state.alreadyPosted) return KIND_CONFIG[kind].alreadyPosted
  return null
}

/** The instructions of a Claude Code command, without its frontmatter, for an agent that has no slash commands. */
export function commandInstructions(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replaceAll("$ARGUMENTS", "")
    .trim()
}

/** Claude Code runs the slash command; Codex reads the same command's file. */
async function standupPrompt(agent: AgentConfig, command: string) {
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
    throw new Error(
      `Codex lit la commande ${command} dans ${file}, introuvable : crée-la ou repasse l'IA principale sur Claude.`
    )
  }
}

/** Posts the standup in today's reminder thread, as the user. */
export async function publishStandup(
  db: Database,
  kind: StandupKind
): Promise<StandupState> {
  const state = await readStandup(db, kind)
  const blocker = publishBlocker(state, kind)
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
  const { permalink } = parseReply(answer)
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
        ...getAgentConfig(process.env, await getPreferences(db)),
        model: undefined,
      }
      const answer = await runAgent(
        {
          prompt: await standupPrompt(agent, config.command),
          appendSystemPrompt: config.systemPrompt,
          schema: standupJsonSchema(kind),
          allowedTools: ["Bash", "Read", "Write", ...SLACK_READ_TOOLS],
          sandbox: "workspace-write",
          timeoutMs: config.timeoutMs,
        },
        agent
      )
      const result = parseStandup(answer)
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
          title: config.readyTitle,
          body:
            result.note ??
            "Relis-le dans le récap du jour, puis publie-le dans Slack.",
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
