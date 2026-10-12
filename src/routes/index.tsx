import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { InboxIcon } from "lucide-react"
import { z } from "zod"
import { DetailPanel } from "@/components/inbox/detail-panel"
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
})

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ folder: search.folder, repo: search.repo }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(inboxQuery(deps.folder, deps.repo)),
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
  const { data, isPending } = useQuery(inboxQuery(search.folder, search.repo))
  const actions = useInboxActions()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = data?.items ?? []
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
    Escape: () => void select(undefined),
    e: () => {
      if (!selected) return
      // Moves to the next item so triage keeps flowing.
      const next = items.at(selectedIndex + 1) ?? items.at(selectedIndex - 1)
      actions.done.mutate({ key: selected.key, done: selected.doneAt === null })
      void select(next?.key)
    },
    o: () =>
      selected &&
      window.open(selected.awaitingUrl ?? selected.htmlUrl, "_blank"),
    r: () => composerRef.current?.focus(),
  })

  const meta = FOLDER_META[search.folder]

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
            <h1 className="flex items-baseline gap-2 font-heading text-lg font-semibold tracking-tight">
              {meta.label}
              {search.folder === "other" && data && (
                <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
                  {data.counts.other}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">{meta.hint}</p>
          </div>
          <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:flex">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd>
          </span>
        </header>
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
              <div key={item.key} data-key={item.key}>
                <ItemStrip
                  item={item}
                  selected={item.key === selected?.key}
                  onSelect={() => void select(item.key)}
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
          composerRef={composerRef}
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
    </div>
  )
}
