import { eq } from "drizzle-orm"
import { z } from "zod"
import type { Database } from "@/server/db/client"
import { ATTENTION_KINDS, SUMMARY_LENGTHS, settings } from "@/server/db/schema"
import type { SlackDiscussion } from "@/server/db/schema"

/** A local time of day, `HH:MM`. */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Options edited in the settings page. `null` falls back to the `.env` value. */
export const preferencesSchema = z.object({
  slackExcludedChannels: z.array(z.string()).default([]),
  slackAutoSearch: z.boolean().default(true),
  /** After a review sent from the app, offer to tell the author on Slack. */
  reviewNoticeEnabled: z.boolean().default(true),
  reviewNoticeChannel: z.string().trim().min(1).default("pull-requests"),
  agentCli: z.enum(["claude", "codex"]).nullable().default(null),
  agentModel: z.string().trim().min(1).nullable().default(null),
  summaryModel: z.string().trim().min(1).nullable().default(null),
  summaryLength: z.enum(SUMMARY_LENGTHS).default("short"),
  notifyEnabled: z.boolean().default(true),
  notifyKinds: z.array(z.enum(ATTENTION_KINDS)).default([...ATTENTION_KINDS]),
  reviewCommands: z
    .array(z.string().trim().min(1))
    .default(["@codex review", "@claude review", "/gemini review"]),
  autoDoneClosed: z.boolean().default(true),
  autoDoneBots: z.boolean().default(true),
  autoDoneCi: z.boolean().default(true),
  autoDoneReleases: z.boolean().default(true),
  autoDoneAuthors: z.array(z.string().trim().min(1)).default([]),
  recapEnabled: z.boolean().default(true),
  recapTime: z.string().regex(TIME).default("09:05"),
  standupEnabled: z.boolean().default(true),
  myStandupEnabled: z.boolean().default(true),
  teamStaleDays: z.number().int().min(1).max(90).default(7),
  reviewSlaHours: z.number().int().min(1).max(240).default(24),
  /** `owner/number` of the project whose sprint « Mes issues » shows; null picks one. */
  sprintProject: z.string().nullable().default(null),
})

export type Preferences = z.infer<typeof preferencesSchema>

/** Without defaults: a patch must leave the options it does not mention untouched. */
export const preferencesPatchSchema = z.object({
  slackExcludedChannels: z.array(z.string()).optional(),
  slackAutoSearch: z.boolean().optional(),
  reviewNoticeEnabled: z.boolean().optional(),
  reviewNoticeChannel: z.string().trim().min(1).optional(),
  agentCli: z.enum(["claude", "codex"]).nullable().optional(),
  agentModel: z.string().trim().min(1).nullable().optional(),
  summaryModel: z.string().trim().min(1).nullable().optional(),
  summaryLength: z.enum(SUMMARY_LENGTHS).optional(),
  notifyEnabled: z.boolean().optional(),
  notifyKinds: z.array(z.enum(ATTENTION_KINDS)).optional(),
  reviewCommands: z.array(z.string().trim().min(1)).optional(),
  autoDoneClosed: z.boolean().optional(),
  autoDoneBots: z.boolean().optional(),
  autoDoneCi: z.boolean().optional(),
  autoDoneReleases: z.boolean().optional(),
  autoDoneAuthors: z.array(z.string().trim().min(1)).optional(),
  recapEnabled: z.boolean().optional(),
  recapTime: z.string().regex(TIME).optional(),
  standupEnabled: z.boolean().optional(),
  myStandupEnabled: z.boolean().optional(),
  teamStaleDays: z.number().int().min(1).max(90).optional(),
  reviewSlaHours: z.number().int().min(1).max(240).optional(),
  sprintProject: z.string().nullable().optional(),
})

const KEY = "preferences"

/** `#Tech-Team-General`, `tech-team-general` and ` #tech-team-general ` are the same channel. */
export function normalizeChannel(channel: string): string {
  return channel.trim().replace(/^#/, "").toLowerCase()
}

export async function getPreferences(db: Database): Promise<Preferences> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, KEY))
  ).at(0)
  const parsed = preferencesSchema.safeParse(row?.value ?? {})
  return parsed.success ? parsed.data : preferencesSchema.parse({})
}

export async function updatePreferences(
  db: Database,
  patch: z.infer<typeof preferencesPatchSchema>
): Promise<Preferences> {
  const defined = Object.fromEntries(
    (Object.entries(patch) as [string, unknown][]).filter(
      ([, value]) => value !== undefined
    )
  )
  const next = preferencesSchema.parse({
    ...(await getPreferences(db)),
    ...defined,
  })
  next.slackExcludedChannels = [
    ...new Set(
      next.slackExcludedChannels.map(normalizeChannel).filter(Boolean)
    ),
  ].sort()
  next.autoDoneAuthors = [
    ...new Set(
      next.autoDoneAuthors.map((login) => login.replace(/^@/, "").toLowerCase())
    ),
  ].sort()
  await db
    .insert(settings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } })
  return next
}

/** The channel's id from a thread permalink (`…/archives/D01ABCD2EFG/p…`), lowercased. */
export function channelIdOf(permalink: string): string | null {
  return /\/archives\/([A-Z0-9]+)\//i.exec(permalink)?.[1].toLowerCase() ?? null
}

/**
 * The names and channel ids to hide. The search agent names one channel in
 * several ways (a DM above all), so an excluded name also excludes the ids of
 * every thread already seen under that name, whatever the name it gets next.
 */
export function resolveExclusions(
  excluded: string[],
  known: Pick<SlackDiscussion, "channel" | "permalink">[]
): Set<string> {
  const hidden = new Set(excluded.map(normalizeChannel))
  for (const discussion of known) {
    const id = channelIdOf(discussion.permalink)
    if (id && hidden.has(normalizeChannel(discussion.channel))) hidden.add(id)
  }
  return hidden
}

export function withoutExcludedChannels(
  discussions: SlackDiscussion[],
  excluded: string[] | Set<string>
): SlackDiscussion[] {
  const hidden =
    excluded instanceof Set
      ? excluded
      : resolveExclusions(excluded, discussions)
  if (hidden.size === 0) return discussions
  return discussions.filter((discussion) => {
    const id = channelIdOf(discussion.permalink)
    return (
      !hidden.has(normalizeChannel(discussion.channel)) &&
      !(id && hidden.has(id))
    )
  })
}
