export const APP_NAME = "Zéro Ping"

/** Versioned so browsers drop a cached older logo; bump it when the logo changes. */
export const LOGO_URL = "/logo.svg?v=bell"

export function formatPings(count: number): string {
  return count > 99 ? "99+" : String(count)
}

/** `(3) Zéro Ping`, or the bare name once nothing is waiting. */
export function pageTitle(title: string, count: number): string {
  const bare = title.replace(/^\(\d+\+?\)\s*/, "")
  return count > 0 ? `(${formatPings(count)}) ${bare}` : bare
}

/** The logo with a red count badge in its top-right corner, as an SVG favicon. */
export function badgedLogo(logoSvg: string, count: number): string {
  if (count <= 0) return logoSvg
  const label = formatPings(count)
  const size = label.length === 1 ? 10 : label.length === 2 ? 8.5 : 7
  const badge = `<circle cx="24" cy="8" r="8" fill="#E11D48" stroke="#1E1B4B" stroke-width="1.5"/><text x="24" y="8" dy="0.36em" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif" font-weight="700" font-size="${size}" fill="#fff">${label}</text>`
  return logoSvg.replace("</svg>", `${badge}</svg>`)
}
