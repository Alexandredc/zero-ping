import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { CheckIcon, ClockIcon, InboxIcon, XIcon } from "lucide-react"
import { z } from "zod"
import { DetailPanel } from "@/components/inbox/detail-panel"
import { ReviewDialog } from "@/components/inbox/review-dialog"
import type { PendingReview } from "@/components/inbox/review-dialog"
import { FOLDER_META } from "@/components/inbox/folders"
import { ItemStrip } from "@/components/inbox/item-strip"
import { Sidebar } from "@/components/inbox/sidebar"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Kbd } from "@/components/ui/kbd"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatWhen, nextMorning } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { inboxQuery, useInboxActions } from "@/hooks/use-inbox"
import { useHotkeys } from "@/hooks/use-hotkeys"

const searchSchema = z.object({
  folder: z
    .enum(["review", "awaiting", "mine", "other", "snoozed", "done"])
    .default("review"),
  repo: z.string().optional(),
  item: z.string().optional(),
  sort: z.enum(["priority", "size"]).default("priority"),
  /** « Mes PR » only: the viewer's PRs, or every open PR of the tracked repos. */
  scope: z.enum(["mine", "all"]).default("mine"),
})

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    folder: search.folder,
    repo: search.repo,
    sort: search.sort,
    scope: search.scope,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      inboxQuery(deps.folder, deps.repo, deps.sort, deps.scope)
    ),
  component: InboxPage,
})

const EMPTY_COPY = {
  review:
    "Aucune review en attente. Les nouvelles demandes apparaîtront ici dans la minute.",
  awaiting: "Personne n'attend de réponse de ta part.",
  mine: "Aucune PR ouverte à ton nom.",
  other: "Rien d'autre dans les repos suivis.",
  snoozed: "Rien en pause.",
  done: "Rien de traité pour l'instant. Utilise e pour marquer un élément comme traité.",
}

function InboxPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/" })
  const allPulls = search.folder === "mine" && search.scope === "all"
  const { data, isPending } = useQuery(
    inboxQuery(search.folder, search.repo, search.sort, search.scope)
  )
  const actions = useInboxActions()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  // Kept by the page: an approved PR leaves its folder and closes the panel.
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  const items = data?.items ?? []
  // Items that left the folder (done, synced away) drop out of the selection.
  const selection = items.filter(
    (item) => item.inInbox && checked.has(item.key)
  )
  const selecting = selection.length > 0

  useEffect(
    () => setChecked(new Set()),
    [search.folder, search.repo, search.scope]
  )

  const toggleChecked = (key: string) =>
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const clearSelection = () => setChecked(new Set())
  const bulkDone = () => {
    actions.done.mutate({
      keys: selection.map((item) => item.key),
      done: search.folder !== "done",
    })
    clearSelection()
  }
  const bulkSnooze = (until: Date) => {
    actions.snooze.mutate({ keys: selection.map((item) => item.key), until })
    clearSelection()
  }
  const selectedIndex = items.findIndex((item) => item.key === search.item)
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined

  const select = (key: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, item: key }), replace: true })

  useEffect(() => {
    if (!selected) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(selected.key)}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [selected])

  const move = (delta: number) => {
    if (items.length === 0) return
    const next =
      selectedIndex < 0
        ? 0
        : Math.min(items.length - 1, Math.max(0, selectedIndex + delta))
    void select(items[next].key)
  }

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    Escape: () => (selecting ? clearSelection() : void select(undefined)),
    x: () => selected && toggleChecked(selected.key),
    e: () => {
      if (selecting) return bulkDone()
      if (!selected?.inInbox) return
      // Moves to the next item so triage keeps flowing.
      const next = items.at(selectedIndex + 1) ?? items.at(selectedIndex - 1)
      actions.done.mutate({
        keys: [selected.key],
        done: selected.doneAt === null,
      })
      void select(next?.key)
    },
    o: () =>
      selected &&
      window.open(selected.awaitingUrl ?? selected.htmlUrl, "_blank"),
    r: () => composerRef.current?.focus(),
  })

  const meta = FOLDER_META[search.folder]
  const canSort = search.folder !== "done"
  const snoozeOptions = [
    {
      label: "Dans 3 heures",
      until: () => new Date(Date.now() + 3 * 3600_000),
    },
    { label: "Demain matin", until: () => nextMorning() },
    { label: "Lundi matin", until: () => nextMorning(1) },
  ]

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        folder={search.folder}
        counts={data?.counts}
        sync={data?.sync}
        onSync={() => actions.sync.mutate()}
        syncing={actions.sync.isPending}
      />
      <main className="flex w-[26rem] shrink-0 flex-col border-r bg-card/40 max-lg:flex-1">
        <header className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
              <meta.icon className="size-5 shrink-0 text-muted-foreground" />
              {meta.label}
              {search.folder === "other" && data && (
                <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
                  {data.counts.other}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {allPulls
                ? "Toutes les PR ouvertes des repos suivis, classées par l'urgence qu'estime Jev."
                : meta.hint}
            </p>
            {search.folder === "mine" && (
              <ToggleGroup
                size="sm"
                value={[search.scope]}
                onValueChange={(value) => {
                  const scope = value[0] as "mine" | "all" | undefined
                  if (scope)
                    void navigate({
                      search: (prev) => ({ ...prev, scope, item: undefined }),
                    })
                }}
                aria-label="Choisir les PR"
                className="mt-2"
              >
                <ToggleGroupItem value="mine">Mes PR</ToggleGroupItem>
                <ToggleGroupItem value="all">Toutes les PR</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          {canSort && (
            <ToggleGroup
              size="sm"
              value={[search.sort]}
              onValueChange={(value) => {
                const sort = value[0] as "priority" | "size" | undefined
                if (sort)
                  void navigate({ search: (prev) => ({ ...prev, sort }) })
              }}
              aria-label="Trier la liste"
            >
              <ToggleGroupItem value="priority">
                {allPulls ? "Priorité Jev" : "Priorité"}
              </ToggleGroupItem>
              <ToggleGroupItem value="size">Taille</ToggleGroupItem>
            </ToggleGroup>
          )}
        </header>
        {items.length > 0 && (
          <div
            className={cn(
              "flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground",
              selecting && "bg-accent/60 text-foreground"
            )}
          >
            <Checkbox
              aria-label="Tout sélectionner"
              checked={selecting && selection.length === items.length}
              indeterminate={selecting && selection.length < items.length}
              onCheckedChange={(value) =>
                setChecked(
                  value ? new Set(items.map((item) => item.key)) : new Set()
                )
              }
            />
            {selecting ? (
              <>
                <span className="font-medium tabular-nums">
                  {selection.length} sélectionné
                  {selection.length > 1 ? "s" : ""}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="xs" onClick={bulkDone}>
                    <CheckIcon data-icon="inline-start" />
                    {search.folder === "done" ? "Remettre" : "Traités"}
                    <Kbd>e</Kbd>
                  </Button>
                  {search.folder !== "done" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="outline" size="xs" />}
                      >
                        <ClockIcon data-icon="inline-start" />
                        Pause
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>
                            Faire revenir la sélection…
                          </DropdownMenuLabel>
                          {snoozeOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.label}
                              onClick={() => bulkSnooze(option.until())}
                            >
                              {option.label}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {formatWhen(option.until())}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={clearSelection}
                    aria-label="Vider la sélection (Échap)"
                  >
                    <XIcon />
                  </Button>
                </div>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Kbd>x</Kbd> pour sélectionner, <Kbd>j</Kbd>
                <Kbd>k</Kbd> pour naviguer
              </span>
            )}
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1">
          <div ref={listRef}>
            {isPending &&
              Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex gap-3 border-b px-3 py-3">
                  <Skeleton className="h-12 w-9" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            {!isPending && items.length === 0 && (
              <Empty className="py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <InboxIcon />
                  </EmptyMedia>
                  <EmptyTitle>Rien ici</EmptyTitle>
                  <EmptyDescription>
                    {EMPTY_COPY[search.folder]}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {items.map((item) => (
              <div key={item.key} data-key={item.key} className="flex">
                <ItemStrip
                  item={item}
                  selected={item.key === selected?.key}
                  checked={checked.has(item.key)}
                  onCheck={() => toggleChecked(item.key)}
                  onSelect={() => void select(item.key)}
                  gauge={allPulls ? "jev" : "priority"}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </main>
      {selected ? (
        <DetailPanel
          key={selected.key}
          item={selected}
          inInbox={selected.inInbox}
          composerRef={composerRef}
          onReview={setPendingReview}
          onClose={() => void select(undefined)}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center lg:flex">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Choisis un élément ou utilise <Kbd>j</Kbd> pour commencer par le
            plus prioritaire.
          </p>
        </div>
      )}
      {pendingReview && (
        <ReviewDialog
          key={`${pendingReview.key}:${pendingReview.event}`}
          review={pendingReview}
          onClose={() => setPendingReview(null)}
        />
      )}
    </div>
  )
}
