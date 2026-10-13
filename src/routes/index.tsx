import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import { CheckIcon, ClockIcon, InboxIcon, XIcon } from "lucide-react"
import { z } from "zod"
import { DetailPanel } from "@/components/inbox/detail-panel"
import { ReviewDialog } from "@/components/inbox/review-dialog"
import type { PendingReview } from "@/components/inbox/review-dialog"
import { FOLDER_ICONS } from "@/components/inbox/folders"
import { ItemStrip } from "@/components/inbox/item-strip"
import { DetailPlaceholder } from "@/components/inbox/detail-placeholder"
import {
  MatchReason,
  SmartSearchBar,
  useSmartSearch,
} from "@/components/inbox/smart-search"
import type { InboxItem } from "@/server/inbox/actions"
import {
  ActiveFilters,
  ListMenus,
  useListFilters,
} from "@/components/inbox/list-controls"
import {
  PULL_SORT_OPTIONS,
  PULL_SORTS,
  pullFilters,
  serverSort,
  sortPulls,
} from "@/components/inbox/pull-list-options"
import { applyFilters } from "@/lib/list-filters"
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
import {
  checksQuery,
  conversationQuery,
  inboxQuery,
  projectFieldsQuery,
  useInboxActions,
} from "@/hooks/use-inbox"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useI18n } from "@/hooks/use-i18n"

const searchSchema = z.object({
  folder: z
    .enum(["review", "awaiting", "mine", "other", "snoozed", "done"])
    .default("review"),
  repo: z.string().optional(),
  item: z.string().optional(),
  sort: z.enum(PULL_SORTS).default("priority"),
  /** « Mes PR » only: the viewer's PRs, or every open PR of the tracked repos. */
  scope: z.enum(["mine", "all"]).default("mine"),
  /** The open item takes the whole window. */
  full: z.boolean().optional(),
})

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    folder: search.folder,
    repo: search.repo,
    sort: serverSort(search.sort),
    scope: search.scope,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      inboxQuery(deps.folder, deps.repo, deps.sort, deps.scope)
    ),
  component: InboxPage,
})

function pullCandidate(item: InboxItem) {
  return {
    key: item.key,
    title: item.title,
    author: item.author,
    labels: item.labels,
    facts: [
      item.repoFullName,
      item.isDraft ? "draft" : null,
      item.ciState && `CI: ${item.ciState}`,
      item.reviewDecision && `review: ${item.reviewDecision}`,
      `updated ${new Date(item.updatedAt).toISOString().slice(0, 10)}`,
    ].filter((fact): fact is string => Boolean(fact)),
  }
}

function InboxPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: "/" })
  const { t, language } = useI18n()
  const copy = t.inbox.list
  const filterDefs = pullFilters(t)
  const allPulls = search.folder === "mine" && search.scope === "all"
  const { data, isPending } = useQuery(
    inboxQuery(
      search.folder,
      search.repo,
      serverSort(search.sort),
      search.scope
    )
  )
  const actions = useInboxActions()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  // Kept by the page: an approved PR leaves its folder and closes the panel.
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null)

  const filters = useListFilters(
    search.folder === "mine"
      ? `pulls:${search.scope}`
      : `inbox:${search.folder}`
  )
  const loaded = data?.items ?? []
  const listed = sortPulls(
    applyFilters(loaded, filterDefs, filters.selection),
    search.sort
  )
  const smart = useSmartSearch({
    kind: "PR",
    items: listed,
    toCandidate: pullCandidate,
    resetKey: `${search.folder}:${search.scope}:${search.repo ?? ""}`,
  })
  const items = allPulls ? smart.visible : listed
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
  // A search that hides the open item keeps its panel open.
  const selected =
    selectedIndex >= 0
      ? items[selectedIndex]
      : data?.items.find((item) => item.key === search.item)

  const select = (key: string | undefined) =>
    navigate({
      search: (prev) => ({
        ...prev,
        item: key,
        full: key ? prev.full : undefined,
      }),
      replace: true,
    })
  const fullscreen = Boolean(search.full && selected)
  const toggleFullscreen = () =>
    void navigate({
      search: (prev) => ({ ...prev, full: prev.full ? undefined : true }),
      replace: true,
    })

  useEffect(() => {
    if (!selected) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(selected.key)}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [selected])

  // The neighbours are one keystroke away: their panel is ready before ↑ or ↓.
  const queryClient = useQueryClient()
  useEffect(() => {
    if (selectedIndex < 0) return
    const neighbours = [
      items.at(selectedIndex + 1),
      selectedIndex > 0 ? items.at(selectedIndex - 1) : undefined,
    ]
    for (const neighbour of neighbours) {
      if (!neighbour) continue
      // Reading a conversation marks it read on GitHub: an unread one waits for its click.
      if (!neighbour.unread)
        void queryClient.prefetchQuery(conversationQuery(neighbour.key))
      if (neighbour.kind !== "PullRequest") continue
      void queryClient.prefetchQuery(projectFieldsQuery(neighbour.key))
      void queryClient.prefetchQuery(checksQuery(neighbour.key))
    }
    // The selection alone decides: a refreshed list must not prefetch again.
  }, [selected?.key])

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
    Escape: () =>
      fullscreen
        ? toggleFullscreen()
        : selecting
          ? clearSelection()
          : void select(undefined),
    f: () => selected && toggleFullscreen(),
    x: () => selected && toggleChecked(selected.key),
    o: () =>
      selected &&
      window.open(selected.awaitingUrl ?? selected.htmlUrl, "_blank"),
    r: () => composerRef.current?.focus(),
  })

  const meta = t.nav.folders[search.folder]
  const FolderIcon = FOLDER_ICONS[search.folder]
  const canSort = search.folder !== "done"
  const snoozeOptions = [
    {
      label: copy.snoozeIn3Hours,
      until: () => new Date(Date.now() + 3 * 3600_000),
    },
    { label: copy.snoozeTomorrowMorning, until: () => nextMorning() },
    { label: copy.snoozeMondayMorning, until: () => nextMorning(1) },
  ]

  return (
    <div className="flex h-svh overflow-hidden">
      {!fullscreen && (
        <Sidebar
          folder={search.folder}
          counts={data?.counts}
          sync={data?.sync}
          onSync={() => actions.sync.mutate()}
          syncing={actions.sync.isPending}
        />
      )}
      <main
        className={cn(
          "flex w-[26rem] shrink-0 flex-col border-r bg-card/40 max-lg:flex-1",
          fullscreen && "hidden"
        )}
      >
        <header className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
              <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
              {meta.label}
              {search.folder === "other" && data && (
                <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
                  {data.counts.other}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {allPulls ? copy.allPullsHint : meta.hint}
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
                aria-label={copy.choosePulls}
                className="mt-2"
              >
                <ToggleGroupItem value="mine">{copy.myPulls}</ToggleGroupItem>
                <ToggleGroupItem value="all">{copy.allPulls}</ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          <ListMenus
            sort={canSort ? search.sort : undefined}
            sorts={canSort ? PULL_SORT_OPTIONS : undefined}
            onSort={(sort) =>
              void navigate({ search: (prev) => ({ ...prev, sort }) })
            }
            items={loaded}
            filters={filterDefs}
            selection={filters.selection}
            onToggle={filters.toggle}
            onClear={filters.clear}
          />
        </header>
        <ActiveFilters
          filters={filterDefs}
          selection={filters.selection}
          onToggle={filters.toggle}
          onClear={filters.clear}
          shown={listed.length}
          total={loaded.length}
        />
        {allPulls && <SmartSearchBar search={smart} noun="PR" />}
        {items.length > 0 && (
          <div
            className={cn(
              "flex items-center gap-2 border-b px-3 py-1.5 text-xs text-muted-foreground",
              selecting && "bg-accent/60 text-foreground"
            )}
          >
            <Checkbox
              aria-label={copy.selectAll}
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
                  {copy.selected(selection.length)}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="xs" onClick={bulkDone}>
                    <CheckIcon data-icon="inline-start" />
                    {search.folder === "done" ? copy.restore : copy.markDone}
                  </Button>
                  {search.folder !== "done" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="outline" size="xs" />}
                      >
                        <ClockIcon data-icon="inline-start" />
                        {copy.snooze}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>
                            {copy.snoozeSelection}
                          </DropdownMenuLabel>
                          {snoozeOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.label}
                              onClick={() => bulkSnooze(option.until())}
                            >
                              {option.label}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {formatWhen(option.until(), language)}
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
                    aria-label={copy.clearSelection}
                  >
                    <XIcon />
                  </Button>
                </div>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {copy.navigate} · <Kbd>x</Kbd> {copy.select}
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
            {!isPending &&
              items.length === 0 &&
              !smart.query &&
              Object.keys(filters.selection).length === 0 && (
                <Empty className="py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <InboxIcon />
                    </EmptyMedia>
                    <EmptyTitle>{copy.empty.title}</EmptyTitle>
                    <EmptyDescription>
                      {copy.empty[search.folder]}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            {items.map((item) => (
              <div key={item.key} data-key={item.key} className="flex flex-col">
                <div className="flex">
                  <ItemStrip
                    item={item}
                    selected={item.key === selected?.key}
                    checked={checked.has(item.key)}
                    onCheck={() => toggleChecked(item.key)}
                    onSelect={() => void select(item.key)}
                    gauge={allPulls ? "jev" : "priority"}
                  />
                </div>
                <MatchReason
                  reason={allPulls ? smart.reasonOf(item.key) : null}
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
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      ) : (
        <DetailPlaceholder
          title={
            items.length > 0
              ? t.inbox.placeholder.count(items.length)
              : t.inbox.placeholder.nothingToOpen
          }
        >
          {items.length > 0
            ? t.inbox.placeholder.pickOne
            : t.inbox.placeholder.changeFolder}
        </DetailPlaceholder>
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
