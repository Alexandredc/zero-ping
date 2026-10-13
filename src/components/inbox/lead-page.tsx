import { Sidebar } from "./sidebar"
import { PAGE_META } from "./pages"
import { ScrollArea } from "@/components/ui/scroll-area"

type LeadPageKey = Exclude<keyof typeof PAGE_META, "settings">

/**
 * Shared frame of the pages outside the inbox (Lead, « Mes issues »): the same header (icon, title, description,
 * actions, optional toolbar), the same width and the same spacing between
 * cards, so that moving between them feels like one place.
 */
export function LeadPage({
  page,
  description,
  actions,
  toolbar,
  children,
}: {
  page: LeadPageKey
  description: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  const meta = PAGE_META[page]
  const Icon = meta.icon
  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar page={page} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
                  <Icon className="size-5 shrink-0 text-muted-foreground" />
                  {meta.label}
                </h1>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
              {actions && (
                <div className="flex shrink-0 items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
            {toolbar}
          </div>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}

/** The day, as the Lead pages show it under their title. */
export function todayLabel(now: Date = new Date()): string {
  const label = now.toLocaleDateString("fr", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
