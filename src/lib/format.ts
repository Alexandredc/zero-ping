import { DEFAULT_LANGUAGE } from "@/lib/i18n/core"
import type { Language } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"

const relative = Object.fromEntries(
  (["fr", "en"] as const).map((language) => [
    language,
    new Intl.RelativeTimeFormat(language, { numeric: "auto", style: "short" }),
  ])
) as Record<Language, Intl.RelativeTimeFormat>

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

/** "il y a 3 j" / "3 days ago". */
export function timeAgo(
  date: Date | string | null,
  language: Language = DEFAULT_LANGUAGE,
  now: Date = new Date()
): string {
  if (!date) return ""
  const seconds = Math.round((new Date(date).getTime() - now.getTime()) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size)
      return relative[language].format(Math.round(seconds / size), unit)
  }
  return messagesFor(language).common.justNow
}

/** The time elapsed without "il y a" / "ago", to read in a sentence: "depuis 3 j". */
export function elapsed(
  date: Date | string | null,
  language: Language = DEFAULT_LANGUAGE,
  now: Date = new Date()
): string {
  return timeAgo(date, language, now)
    .replace(/^il y a\s/, "")
    .replace(/\sago$/, "")
}

export function avatarUrl(login: string | null, size = 40): string | undefined {
  return login ? `https://github.com/${login}.png?size=${size}` : undefined
}

/** Next occurrence of the given weekday (0 = Sunday) at 9:00, or tomorrow when omitted. */
export function nextMorning(weekday?: number, now: Date = new Date()): Date {
  const date = new Date(now)
  date.setHours(9, 0, 0, 0)
  let days = 1
  if (weekday !== undefined) {
    days = (weekday - now.getDay() + 7) % 7 || 7
  }
  date.setDate(date.getDate() + days)
  return date
}

/** "aujourd'hui 17:30", "demain 09:00" or "lun. 13 oct. 09:00". */
export function formatWhen(
  date: Date,
  language: Language = DEFAULT_LANGUAGE,
  now: Date = new Date()
): string {
  const { common } = messagesFor(language)
  const time = date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
  })
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
  if (days === 0) return common.atTime(common.today, time)
  if (days === 1) return common.atTime(common.tomorrow, time)
  return common.atTime(
    date.toLocaleDateString(language, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    time
  )
}

export type PullSize = "XS" | "S" | "M" | "L" | "XL"

/** T-shirt size of a PR from its changed lines, to pick quick reviews at a glance. */
export function pullSize(
  additions: number,
  deletions: number | null
): PullSize {
  const lines = additions + (deletions ?? 0)
  if (lines <= 10) return "XS"
  if (lines <= 100) return "S"
  if (lines <= 400) return "M"
  if (lines <= 1000) return "L"
  return "XL"
}
