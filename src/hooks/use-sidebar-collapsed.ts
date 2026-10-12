import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "sidebar-collapsed"

/** Collapsed state of the sidebar, remembered in this browser. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      // Storage unavailable: the sidebar stays expanded.
    }
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        // The choice still applies to this page.
      }
      return next
    })
  }, [])

  return { collapsed, toggle }
}
