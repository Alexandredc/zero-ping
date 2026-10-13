import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { routeTree } from "./routeTree.gen"
import { ErrorPage, NotFoundPage } from "./components/status-page"

export function getRouter() {
  const queryClient = new QueryClient({
    // Kept half an hour after the panel closes: an item opened again shows at
    // once what it showed, and refreshes behind (stale-while-revalidate).
    defaultOptions: { queries: { staleTime: 2000, gcTime: 30 * 60_000 } },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFoundPage,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
