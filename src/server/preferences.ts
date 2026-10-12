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
  teamStaleDays: z.number().int().min(1).max(90).default(7),
})

export type Preferences = z.infer<typeof preferencesSchema>

/** Without defaults: a patch must leave the options it does not mention untouched. */
export const preferencesPatchSchema = z.object({
  slackExcludedChannels: z.array(z.string()).optional(),
  slackAutoSearch: z.boolean().optional(),
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
  teamStaleDays: z.number().int().min(1).max(90).optional(),
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

export function withoutExcludedChannels(
  discussions: SlackDiscussion[],
  excluded: string[]
): SlackDiscussion[] {
  if (excluded.length === 0) return discussions
  const hidden = new Set(excluded.map(normalizeChannel))
  return discussions.filter(
    (discussion) => !hidden.has(normalizeChannel(discussion.channel))
  )
}
