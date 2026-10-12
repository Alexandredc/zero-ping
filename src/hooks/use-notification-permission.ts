import { useCallback, useEffect, useState } from "react"

export type Permission = NotificationPermission | "unsupported"

function current(): Permission {
  return typeof Notification === "undefined"
    ? "unsupported"
    : Notification.permission
}

/** Browser notification permission, refreshed when the tab regains focus. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<Permission>("default")

  useEffect(() => {
    setPermission(current())
    const refresh = () => setPermission(current())
    window.addEventListener("focus", refresh)
    return () => window.removeEventListener("focus", refresh)
  }, [])

  const request = useCallback(async () => {
    if (typeof Notification === "undefined") return
    setPermission(await Notification.requestPermission())
  }, [])

  return { permission, request }
}
