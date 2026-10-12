import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { AttentionWatcher } from "@/components/notifications/attention-watcher"
import { PingIndicators } from "@/components/notifications/ping-indicators"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider, themeScript } from "@/lib/theme"
import { APP_NAME, LOGO_URL } from "@/lib/pings"

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: APP_NAME },
        { name: "theme-color", content: "#1E1B4B" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: LOGO_URL, type: "image/svg+xml" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=bell" },
        { rel: "manifest", href: "/manifest.json" },
      ],
    }),
    notFoundComponent: () => (
      <main className="container mx-auto p-4 pt-16">
        <h1 className="font-heading text-2xl">Page introuvable</h1>
        <p className="text-muted-foreground">
          Cette adresse ne correspond à aucune vue.
        </p>
      </main>
    ),
    shellComponent: RootDocument,
  }
)

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster>
              {children}
              <AttentionWatcher />
              <PingIndicators />
            </Toaster>
          </TooltipProvider>
        </ThemeProvider>
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: "bottom-left" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
