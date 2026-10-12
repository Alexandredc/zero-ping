import { useEffect, useRef } from "react"

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  )
}

/** Single-key shortcuts, ignored while typing or when a modifier is held. */
export function useHotkeys(bindings: Partial<Record<string, () => void>>) {
  const ref = useRef(bindings)
  ref.current = bindings

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      )
        return
      if (document.querySelector("[role=menu], [role=dialog]")) return
      const handler = ref.current[event.key]
      if (!handler) return
      event.preventDefault()
      handler()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
