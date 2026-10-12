import { useRouter } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import type { AttentionKind } from "@/server/db/schema"
import type { Folder } from "@/server/inbox/actions"
import { getAttentionEvents } from "@/functions/inbox"

const POLL_MS = 10_000

const FOLDER_FOR: Record<Exclude<AttentionKind, "recap">, Folder> = {
  review: "review",
  awaiting: "awaiting",
  changes: "mine",
  ci: "mine",
}

export function showNotification(
  title: string,
  options: NotificationOptions,
  onClick?: () => void
) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return
  const notification = new Notification(title, {
    icon: "/logo-192.png?v=bell",
    ...options,
  })
  notification.onclick = () => {
    window.focus()
    onClick?.()
    notification.close()
  }
}

/**
 * Polls the attention events recorded by the sync and turns new ones into
 * browser notifications. The first poll only sets the baseline, so opening the
 * app never replays old events.
 */
export function AttentionWatcher() {
  const router = useRouter()
  const lastId = useRef<number | null>(null)

  useEffect(() => {
    let stopped = false
    const poll = async () => {
      try {
        const { latestId, events } = await getAttentionEvents({
          data: { afterId: lastId.current },
        })
        if (stopped) return
        for (const event of events) {
          showNotification(
            event.title,
            // The tag collapses the same item across several open tabs.
            { body: event.body, tag: `${event.itemKey}:${event.kind}` },
            () =>
              void (event.kind === "recap"
                ? router.navigate({ to: "/recap" })
                : router.navigate({
                    to: "/",
                    search: {
                      folder: FOLDER_FOR[event.kind],
                      item: event.itemKey,
                    },
                  }))
          )
        }
        lastId.current = Math.max(latestId, lastId.current ?? 0)
      } catch {
        // The server may be restarting; the next poll retries.
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [router])

  return null
}
