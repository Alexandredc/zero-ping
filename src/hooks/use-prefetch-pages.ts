import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { allIssuesQuery, inboxQuery, issuesQuery } from "@/hooks/use-inbox"

/** A list loaded less than this long ago is not loaded again on the next page. */
const PREFETCH_FRESH_MS = 30_000

/**
 * Loads the lists of « À traiter », then those of « Parcourir », once the
 * open page is idle, so that switching pages shows them at once.
 */
export function usePrefetchPages() {
  const queryClient = useQueryClient()
  useEffect(() => {
    let cancelled = false
    const prefetchList = (options: ReturnType<typeof inboxQuery>) =>
      queryClient.prefetchQuery({ ...options, staleTime: PREFETCH_FRESH_MS })
    const run = async () => {
      await Promise.allSettled([
        prefetchList(inboxQuery("review")),
        prefetchList(inboxQuery("awaiting")),
        prefetchList(inboxQuery("mine")),
        queryClient.prefetchQuery(issuesQuery()),
      ])
      if (cancelled) return
      await Promise.allSettled([
        prefetchList(inboxQuery("mine", undefined, "priority", "all")),
        queryClient.prefetchInfiniteQuery(allIssuesQuery()),
      ])
    }
    // Safari has no requestIdleCallback: a short delay lets the page load first.
    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(() => void run(), {
        timeout: 2000,
      })
      return () => {
        cancelled = true
        window.cancelIdleCallback(handle)
      }
    }
    const timer = setTimeout(() => void run(), 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [queryClient])
}
