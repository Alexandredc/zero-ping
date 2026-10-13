export type QuietPreferences = {
  dndUntil: string | null
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

/**
 * Whether notifications are muted now, and until when: by « Ne pas déranger »,
 * or by the daily quiet hours (local time).
 */
export function doNotDisturb(
  preferences: QuietPreferences,
  now: Date = new Date()
): { muted: boolean; reason: "dnd" | "quiet" | null } {
  if (preferences.dndUntil && new Date(preferences.dndUntil) > now)
    return { muted: true, reason: "dnd" }
  if (preferences.quietHoursEnabled) {
    const minute = now.getHours() * 60 + now.getMinutes()
    const start = minutesOf(preferences.quietStart)
    const end = minutesOf(preferences.quietEnd)
    const quiet =
      start <= end
        ? minute >= start && minute < end
        : minute >= start || minute < end
    if (quiet) return { muted: true, reason: "quiet" }
  }
  return { muted: false, reason: null }
}

/** « Ne pas déranger » for good: until it is turned off. */
export const DND_FOREVER = "2100-01-01T00:00:00.000Z"

export function isForever(until: string | null): boolean {
  return until !== null && new Date(until).getFullYear() >= 2100
}
