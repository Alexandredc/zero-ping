import { createFileRoute } from "@tanstack/react-router"
import { countPings, ensureSyncLoop } from "@/server/inbox/api"

/** Plain-text count of the items waiting for the viewer, read by the macOS app's Dock badge. */
export const Route = createFileRoute("/api/pings")({
  server: {
    handlers: {
      GET: async () => {
        // The app may poll before any tab is open: it keeps the sync running too.
        ensureSyncLoop()
        return new Response(String(await countPings()), {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
          },
        })
      },
    },
  },
})
