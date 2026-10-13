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
  if (!login) return undefined
  // The demo's people are fictional: their logins may be real GitHub accounts.
  if (import.meta.env.VITE_DEMO === "1") return demoAvatar(login)
  return `https://github.com/${login}.png?size=${size}`
}

const AVATAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
]

/** Initials on a color picked from the login, drawn locally. */
export function demoAvatar(login: string): string {
  const hash = [...login].reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0,
    7
  )
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length]
  const initials = login
    .replace(/\[bot\]$/, "")
    .split(/[-_]/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${color}"/><text x="20" y="25.5" font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="#fff" text-anchor="middle">${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
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
export function formatWhen(date: Date, now: Date = new Date()): string {
  const time = date.toLocaleTimeString("fr", {
    hour: "2-digit",
    minute: "2-digit",
  })
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
  if (days === 0) return `aujourd'hui ${time}`
  if (days === 1) return `demain ${time}`
  return `${date.toLocaleDateString("fr", { weekday: "short", day: "numeric", month: "short" })} ${time}`
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
