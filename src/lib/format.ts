const relative = new Intl.RelativeTimeFormat("fr", {
  numeric: "auto",
  style: "short",
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

export function timeAgo(
  date: Date | string | null,
  now: Date = new Date()
): string {
  if (!date) return ""
  const seconds = Math.round((new Date(date).getTime() - now.getTime()) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size)
      return relative.format(Math.round(seconds / size), unit)
  }
  return "à l'instant"
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
