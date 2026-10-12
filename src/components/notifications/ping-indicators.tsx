import { useQuery } from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { pingCountQuery } from "@/hooks/use-inbox"
import { APP_NAME, LOGO_URL, badgedLogo, pageTitle } from "@/lib/pings"

/**
 * Shows the number of items waiting in the tab: in the page title and as a
 * badge on the favicon. Re-applied after each navigation, since the router
 * rewrites the head.
 */
export function PingIndicators() {
  const { data: count = 0 } = useQuery(pingCountQuery())
  const href = useRouterState({ select: (state) => state.location.href })
  const [logo, setLogo] = useState<string | null>(null)

  useEffect(() => {
    fetch(LOGO_URL)
      .then((response) => response.text())
      .then(setLogo)
      .catch(() => setLogo(null))
  }, [])

  useEffect(() => {
    document.title = pageTitle(document.title || APP_NAME, count)
  }, [count, href])

  useEffect(() => {
    if (!logo) return
    const url = `data:image/svg+xml,${encodeURIComponent(badgedLogo(logo, count))}`
    for (const link of document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"]'
    )) {
      link.href = url
    }
  }, [logo, count, href])

  return null
}
