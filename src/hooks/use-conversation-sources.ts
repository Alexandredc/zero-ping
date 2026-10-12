import { useCallback, useEffect, useState } from "react"

export type ConversationSources = { github: boolean; slack: boolean }

const STORAGE_KEY = "conversation-sources"
const BOTH: ConversationSources = { github: true, slack: true }

/** Which sources the conversation tab shows, remembered in this browser. */
export function useConversationSources() {
  const [sources, setSources] = useState<ConversationSources>(BOTH)

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "null"
      ) as ConversationSources | null
      if (stored && (stored.github || stored.slack)) setSources(stored)
    } catch {
      // Storage unavailable or unreadable: both sources are shown.
    }
  }, [])

  const toggle = useCallback(
    (source: keyof ConversationSources, on: boolean) => {
      setSources((current) => {
        const next = { ...current, [source]: on }
        // At least one source stays visible.
        if (!next.github && !next.slack) return current
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // The choice still applies to this page.
        }
        return next
      })
    },
    []
  )

  return { sources, toggle }
}
