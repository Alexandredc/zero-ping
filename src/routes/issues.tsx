import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  FileTextIcon,
  GitPullRequestIcon,
  KanbanSquareIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react"
import { z } from "zod"
import { Hint } from "@/components/inbox/hint"
import { JevGauge } from "@/components/inbox/jev-gauge"
import { PAGE_ICONS } from "@/components/inbox/pages"
import { Sidebar } from "@/components/inbox/sidebar"
import { WorkItemPreview } from "@/components/issues/work-item-preview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useI18n } from "@/hooks/use-i18n"
import { DetailPlaceholder } from "@/components/inbox/detail-placeholder"
import {
  MatchReason,
  SmartSearchBar,
  useSmartSearch,
} from "@/components/inbox/smart-search"
import {
  ActiveFilters,
  ListMenus,
  useListFilters,
} from "@/components/inbox/list-controls"
import { applyFilters, byDate } from "@/lib/list-filters"
import { sortOptions } from "@/lib/sorts"
import type { FilterDef } from "@/lib/list-filters"
import { issuesQuery, useSavePreferences } from "@/hooks/use-inbox"
import { avatarUrl, elapsed } from "@/lib/format"
import type { Language } from "@/lib/i18n/core"
import type { Messages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"
import { sprintDay } from "@/server/issues/iteration"
import type { Sprint, SprintStatus, WorkItem } from "@/server/issues/sprint"

const TABS = ["assigned", "mine", "team"] as const
type Tab = (typeof TABS)[number]

export const Route = createFileRoute("/issues")({
  validateSearch: z.object({
    tab: z.enum(TABS).default("assigned"),
    item: z.string().optional(),
    sort: z.enum(["jev", "recent", "oldest"]).default("jev"),
    /** The open issue takes the whole window. */
    full: z.boolean().optional(),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(issuesQuery()),
  component: IssuesPage,
})

const UNASSIGNED = "__unassigned"
const EVERYONE = "__everyone"

const sameLogin = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

type Group = { name: string; color: string | null; items: WorkItem[] }

type Sort = "jev" | "recent" | "oldest"

const SORTS = sortOptions<Sort>({
  jev: "priority",
  recent: "recent",
  oldest: "oldest",
})

function issueFilters(t: Messages): FilterDef<WorkItem>[] {
  const labels = t.issues.filters
  return [
    {
      id: "kind",
      label: labels.kind,
      valuesOf: (item) => [item.kind],
      options: (["issue", "pull", "draft"] as const).map((kind) => ({
        value: kind,
        label: labels.kinds[kind],
      })),
    },
    {
      id: "status",
      label: labels.status,
      valuesOf: (item) => [item.status ?? t.issues.noStatus],
    },
    {
      id: "jev",
      label: labels.jev,
      valuesOf: (item) => (item.urgency === null ? [] : [String(item.urgency)]),
      options: [3, 2, 1, 0].map((level) => ({
        value: String(level),
        label: t.issues.urgency[level],
      })),
    },
    {
      id: "repo",
      label: labels.repo,
      valuesOf: (item) => (item.repo ? [item.repo.split("/")[1]] : []),
    },
    {
      id: "label",
      label: labels.label,
      valuesOf: (item) => item.labels.map((label) => label.name),
    },
  ]
}

/** Jev's most urgent first, unscored tickets after; the most recent breaks ties. */
function sortItems(items: WorkItem[], sort: Sort): WorkItem[] {
  const recent = (a: WorkItem, b: WorkItem) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  return [...items].sort((a, b) =>
    sort === "jev"
      ? (b.urgency ?? -1) - (a.urgency ?? -1) || recent(a, b)
      : sort === "oldest"
        ? byDate<WorkItem>((item) => item.updatedAt, "asc")(a, b)
        : recent(a, b)
  )
}

/** One group per board column, in the board's order; items without a status close the list. */
function groupByStatus(
  items: WorkItem[],
  statuses: SprintStatus[],
  noStatus: string
): Group[] {
  const groups: Group[] = statuses
    .map((status) => ({
      name: status.name,
      color: status.color,
      items: items.filter((item) => item.status === status.name),
    }))
    .filter((group) => group.items.length > 0)
  const known = new Set(statuses.map((s) => s.name))
  const rest = items.filter((item) => !item.status || !known.has(item.status))
  if (rest.length > 0) groups.push({ name: noStatus, color: null, items: rest })
  return groups
}

function PersonAvatar({
  login,
  className,
}: {
  login: string
  className?: string
}) {
  return (
    <Avatar className={cn("size-5", className)}>
      <AvatarImage src={avatarUrl(login)} alt="" />
      <AvatarFallback className="text-[0.5rem]">
        {login.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function KindIcon({ item }: { item: WorkItem }) {
  const className = "size-3.5 shrink-0"
  if (item.kind === "pull") return <GitPullRequestIcon className={className} />
  if (item.kind === "draft") return <FileTextIcon className={className} />
  return <CircleDotIcon className={className} />
}

function StatusDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        !color && "bg-muted-foreground"
      )}
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

/** A list row shaped like the inbox strips: repo and chips on top, the title below. */
function WorkStrip({
  item,
  statuses,
  selected,
  showStatus,
  showAssignees,
  onSelect,
}: {
  item: WorkItem
  statuses: SprintStatus[]
  selected: boolean
  showStatus: boolean
  showAssignees: boolean
  onSelect: () => void
}) {
  const { t, language } = useI18n()
  const color = statuses.find((s) => s.name === item.status)?.color ?? null
  const [owner, name] = item.repo?.split("/") ?? []
  return (
    <button
      type="button"
      data-key={item.key}
      data-selected={selected || undefined}
      onClick={onSelect}
      className="flex w-full gap-3 border-b py-2.5 pr-4 pl-2 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 data-selected:bg-accent data-selected:hover:bg-accent"
    >
      <JevGauge urgency={item.urgency} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
          <KindIcon item={item} />
          <span className="truncate font-mono">
            {item.repo ? (
              <>
                <span className="opacity-60">{owner}/</span>
                {name}
                <span className="opacity-60">#{item.number}</span>
              </>
            ) : (
              t.issues.projectDraft
            )}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {showStatus && item.status && (
              <Hint instant className="flex" content={item.status}>
                <span className="inline-flex h-4 max-w-28 items-center gap-1 rounded border px-1 text-[0.65rem]">
                  <StatusDot color={color} />
                  <span className="truncate">{item.status}</span>
                </span>
              </Hint>
            )}
            {item.updatedAt && (
              <span className="min-w-14 text-right whitespace-nowrap tabular-nums">
                {elapsed(item.updatedAt, language)}
              </span>
            )}
            {showAssignees &&
              (item.assignees.length === 0 ? (
                <Hint instant className="flex" content={t.issues.unassigned}>
                  <span className="size-5 rounded-full border border-dashed" />
                </Hint>
              ) : (
                <span className="flex -space-x-1.5">
                  {item.assignees.slice(0, 2).map((login) => (
                    <Hint
                      key={login}
                      instant
                      className="flex"
                      content={`@${login}`}
                    >
                      <PersonAvatar
                        login={login}
                        className="ring-2 ring-card"
                      />
                    </Hint>
                  ))}
                </span>
              ))}
          </span>
        </span>
        <span className="line-clamp-2 text-sm leading-snug text-foreground/90">
          {item.title}
        </span>
        {item.labels.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.labels.slice(0, 3).map((label) => (
              <span
                key={label.name}
                className="inline-flex items-center gap-1 rounded-full border px-1.5 text-[0.65rem] leading-4 text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: `#${label.color}` }}
                />
                {label.name}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  )
}

/** The sprint's clock and its spread across the board's columns, sized for the list column. */
/** `11 oct. → 24 oct.`: the days the sprint covers, its last day included. */
function sprintPeriod(
  iteration: { startDate: string; duration: number },
  language: Language
) {
  const start = new Date(`${iteration.startDate}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + iteration.duration - 1)
  const format = (date: Date) =>
    date.toLocaleDateString(language, { day: "numeric", month: "short" })
  return `${format(start)} → ${format(end)}`
}

const COLLAPSED_KEY = "issues:collapsed"

/** Collapsed groups survive a reload, per viewer; storage may be unavailable. */
function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY)
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set()
    }
  })
  const toggle = (name: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      } catch {
        // The groups simply open again on the next visit.
      }
      return next
    })
  return { collapsed, toggle }
}

function SprintStrip({ sprint, items }: { sprint: Sprint; items: WorkItem[] }) {
  const { t, language } = useI18n()
  const iteration = sprint.iteration
  if (!iteration) return null
  const day = sprintDay(iteration)
  const left = iteration.duration - day
  const groups = groupByStatus(items, sprint.statuses, t.issues.noStatus)
  return (
    <div className="flex flex-col gap-1.5 border-b px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span>
          <span className="font-semibold">{iteration.title}</span>
          <span className="text-muted-foreground">
            {" "}
            · {sprintPeriod(iteration, language)}
          </span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {t.issues.sprint.day}{" "}
          <span className="font-medium text-foreground">{day}</span>/
          {iteration.duration} · {t.issues.sprint.left(left)}
        </span>
      </div>
      <div
        className="flex gap-0.5"
        role="img"
        aria-label={t.issues.sprint.dayOf(day, iteration.duration)}
      >
        {Array.from({ length: iteration.duration }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full",
              index < day - 1
                ? "bg-foreground/50"
                : index === day - 1
                  ? "bg-heat"
                  : "bg-muted"
            )}
          />
        ))}
      </div>
      {items.length > 0 && (
        <div className="flex h-1.5 overflow-hidden rounded-full">
          {groups.map((group) => (
            <Hint
              key={group.name}
              instant
              className={cn("h-full", !group.color && "bg-muted-foreground")}
              style={{
                width: `${(group.items.length / items.length) * 100}%`,
                backgroundColor: group.color ?? undefined,
              }}
              content={`${group.name} · ${group.items.length}`}
            >
              <span className="sr-only">{group.name}</span>
            </Hint>
          ))}
        </div>
      )}
    </div>
  )
}

function workCandidate(item: WorkItem) {
  return {
    key: item.key,
    title: item.title,
    author: null,
    labels: item.labels.map((label) => label.name),
    facts: [
      item.repo,
      item.kind === "pull"
        ? "pull request"
        : item.kind === "draft"
          ? "draft"
          : null,
      item.status && `status: ${item.status}`,
      item.sprint && `sprint: ${item.sprint}`,
      item.assignees.length > 0 && `assignees: ${item.assignees.join(", ")}`,
    ].filter((fact): fact is string => Boolean(fact)),
  }
}

function IssuesPage() {
  const { t, language } = useI18n()
  const issueCopy = t.issues
  const filterDefs = useMemo(() => issueFilters(t), [t])
  const search = Route.useSearch()
  const tab = search.tab
  const navigate = useNavigate({ from: "/issues" })
  const { data, isPending } = useQuery(issuesQuery())
  const save = useSavePreferences()
  const [showEpics, setShowEpics] = useState(false)
  const [person, setPerson] = useState(EVERYONE)
  const { collapsed, toggle: toggleGroup } = useCollapsedGroups()
  const listRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const viewerLogin = data?.viewerLogin ?? ""
  const sprint = data?.sprint ?? null
  const statuses = sprint?.statuses ?? []
  const currentSprint = sprint?.iteration?.title ?? null
  const sprintItems = (sprint?.items ?? []).filter(
    (item) => showEpics || !item.isEpic
  )
  const mine = sprintItems.filter((item) =>
    item.assignees.some((login) => sameLogin(login, viewerLogin))
  )
  const assigned = data?.assigned ?? []

  const people = [...new Set(sprintItems.flatMap((item) => item.assignees))]
    .map((login) => ({
      login,
      count: sprintItems.filter((item) => item.assignees.includes(login))
        .length,
    }))
    .sort(
      (a, b) => b.count - a.count || a.login.localeCompare(b.login, language)
    )
  const unassigned = sprintItems.filter((item) => item.assignees.length === 0)
  const teamItems =
    person === EVERYONE
      ? sprintItems
      : person === UNASSIGNED
        ? unassigned
        : sprintItems.filter((item) => item.assignees.includes(person))

  const filters = useListFilters(`issues:${tab}`)
  const tabItems =
    tab === "assigned" ? assigned : tab === "mine" ? mine : teamItems
  const filtered = applyFilters(tabItems, filterDefs, filters.selection)
  const smart = useSmartSearch({
    kind: "issue",
    items: filtered,
    toCandidate: workCandidate,
    resetKey: tab,
  })
  // What the filters and the search keep, in the groups' own order.
  const kept = new Set(smart.visible.map((item) => item.key))
  const shown = (list: WorkItem[]) => list.filter((item) => kept.has(item.key))

  const groups: Group[] = smart.ai
    ? // Claude's order is the answer: one group, not split by column.
      [
        {
          name: issueCopy.groups.aiSearch,
          color: null,
          items: smart.visible,
        },
      ]
    : tab === "assigned"
      ? [
          {
            name: currentSprint
              ? issueCopy.groups.inSprint(currentSprint)
              : issueCopy.groups.assigned,
            color: null,
            items: shown(assigned).filter(
              (item) => currentSprint && item.sprint === currentSprint
            ),
          },
          {
            name: issueCopy.groups.offSprint,
            color: null,
            items: shown(assigned).filter(
              (item) => !currentSprint || item.sprint !== currentSprint
            ),
          },
        ].filter((group) => group.items.length > 0)
      : groupByStatus(
          shown(tab === "mine" ? mine : teamItems),
          statuses,
          issueCopy.noStatus
        )
  const sortedGroups = smart.ai
    ? groups
    : groups.map((group) => ({
        ...group,
        items: sortItems(group.items, search.sort),
      }))
  // Collapsed groups drop out of the keyboard navigation.
  const flat = sortedGroups
    .filter((group) => !collapsed.has(group.name))
    .flatMap((group) => group.items)
  const selectedIndex = flat.findIndex((item) => item.key === search.item)
  // A search that hides the open issue keeps its preview open.
  const selected =
    selectedIndex >= 0
      ? flat[selectedIndex]
      : [...assigned, ...sprintItems].find((item) => item.key === search.item)

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

  const move = (delta: number) => {
    if (flat.length === 0) return
    const next =
      selectedIndex < 0
        ? 0
        : Math.min(flat.length - 1, Math.max(0, selectedIndex + delta))
    void select(flat[next].key)
  }

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    Escape: () => (fullscreen ? toggleFullscreen() : void select(undefined)),
    f: () => selected && toggleFullscreen(),
    o: () => selected?.url && window.open(selected.url, "_blank"),
    r: () => composerRef.current?.focus(),
  })

  const project = sprint?.project
  const projects = data?.projects ?? []
  const Icon = PAGE_ICONS.issues
  const personLabel =
    person === EVERYONE
      ? issueCopy.people.everyone
      : person === UNASSIGNED
        ? issueCopy.people.unassigned
        : sameLogin(person, viewerLogin)
          ? issueCopy.people.you
          : person

  return (
    <div className="flex h-svh overflow-hidden">
      {!fullscreen && <Sidebar page="issues" />}
      <main
        className={cn(
          "flex w-[26rem] shrink-0 flex-col border-r bg-card/40 max-lg:flex-1",
          fullscreen && "hidden"
        )}
      >
        <header className="flex flex-col gap-2 border-b px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                {t.nav.pages.issues}
              </h1>
              <p className="text-xs text-muted-foreground">
                {issueCopy.tabHints[tab]}
              </p>
            </div>
            {projects.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={save.isPending}
                      className="max-w-36"
                    />
                  }
                >
                  <KanbanSquareIcon data-icon="inline-start" />
                  <span className="truncate">
                    {project?.title ?? issueCopy.project}
                  </span>
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {issueCopy.sprintProject}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={
                        project ? `${project.owner}/${project.number}` : ""
                      }
                      onValueChange={(value) =>
                        save.mutate({ sprintProject: value as string })
                      }
                    >
                      {projects.map((p) => (
                        <DropdownMenuRadioItem
                          key={`${p.owner}/${p.number}`}
                          value={`${p.owner}/${p.number}`}
                        >
                          <span className="truncate">{p.title}</span>
                          <span className="ml-auto font-mono text-xs text-muted-foreground">
                            {p.owner}/{p.number}
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup
              size="sm"
              value={[tab]}
              onValueChange={(value) => {
                if (value[0])
                  void navigate({
                    search: { tab: value[0] as Tab, item: undefined },
                  })
              }}
              aria-label={issueCopy.tabs.label}
              className="flex-wrap"
            >
              <ToggleGroupItem value="assigned">
                {issueCopy.tabs.assigned}
                <span className="font-mono text-xs tabular-nums">
                  {assigned.length}
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem value="mine" disabled={!currentSprint}>
                {issueCopy.tabs.mine}
                <span className="font-mono text-xs tabular-nums">
                  {mine.length}
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem value="team" disabled={!currentSprint}>
                {issueCopy.tabs.team}
                <span className="font-mono text-xs tabular-nums">
                  {sprintItems.length}
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
            <ListMenus
              sort={search.sort}
              sorts={SORTS}
              onSort={(sort) =>
                void navigate({ search: (prev) => ({ ...prev, sort }) })
              }
              items={tabItems}
              filters={filterDefs}
              selection={filters.selection}
              onToggle={filters.toggle}
              onClear={filters.clear}
            />
          </div>
        </header>
        <ActiveFilters
          filters={filterDefs}
          selection={filters.selection}
          onToggle={filters.toggle}
          onClear={filters.clear}
          shown={filtered.length}
          total={tabItems.length}
        />
        <SmartSearchBar search={smart} noun="issues" />

        {sprint && tab !== "assigned" && (
          <>
            <SprintStrip
              sprint={sprint}
              items={tab === "mine" ? mine : teamItems}
            />
            <div className="flex items-center gap-2 border-b px-4 py-1.5 text-xs text-muted-foreground">
              {tab === "team" && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="xs" className="-ml-2" />
                    }
                  >
                    {person === EVERYONE || person === UNASSIGNED ? (
                      <UsersIcon data-icon="inline-start" />
                    ) : (
                      <PersonAvatar login={person} className="size-4" />
                    )}
                    {personLabel}
                    <span className="font-mono tabular-nums">
                      {teamItems.length}
                    </span>
                    <ChevronDownIcon data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        {issueCopy.people.tasksOf}
                      </DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={person}
                        onValueChange={(value) => {
                          setPerson(value as string)
                          void select(undefined)
                        }}
                      >
                        <DropdownMenuRadioItem value={EVERYONE}>
                          {issueCopy.people.everyone}
                          <span className="ml-auto font-mono text-xs text-muted-foreground">
                            {sprintItems.length}
                          </span>
                        </DropdownMenuRadioItem>
                        {people.map(({ login, count }) => (
                          <DropdownMenuRadioItem key={login} value={login}>
                            <PersonAvatar login={login} className="size-4" />
                            {sameLogin(login, viewerLogin)
                              ? issueCopy.people.you
                              : login}
                            <span className="ml-auto font-mono text-xs text-muted-foreground">
                              {count}
                            </span>
                          </DropdownMenuRadioItem>
                        ))}
                        {unassigned.length > 0 && (
                          <DropdownMenuRadioItem value={UNASSIGNED}>
                            {issueCopy.people.unassigned}
                            <span className="ml-auto font-mono text-xs text-muted-foreground">
                              {unassigned.length}
                            </span>
                          </DropdownMenuRadioItem>
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <label className="ml-auto flex items-center gap-2">
                <Switch
                  size="sm"
                  checked={showEpics}
                  onCheckedChange={setShowEpics}
                />
                {issueCopy.epics}
              </label>
            </div>
          </>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div ref={listRef}>
            {isPending &&
              Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-2 border-b px-4 py-3"
                >
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            {data?.sprintError && tab !== "assigned" && (
              <Alert variant="destructive" className="m-3 w-auto">
                <TriangleAlertIcon />
                <AlertTitle>{issueCopy.sprintUnavailable}</AlertTitle>
                <AlertDescription>{data.sprintError}</AlertDescription>
              </Alert>
            )}
            {/* Collapsed groups are not empty: the message is for an empty list only. */}
            {data &&
              sortedGroups.length === 0 &&
              !smart.query &&
              Object.keys(filters.selection).length === 0 && (
                <Empty className="py-16">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CircleDotIcon />
                    </EmptyMedia>
                    <EmptyTitle>{issueCopy.empty.title}</EmptyTitle>
                    <EmptyDescription>
                      {!project && tab !== "assigned"
                        ? issueCopy.empty.noProject
                        : tab === "assigned"
                          ? issueCopy.empty.noAssigned
                          : issueCopy.empty.noTask}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            {sortedGroups.map((group) => (
              <section key={group.name}>
                <h2 className="sticky top-0 z-10 border-b bg-muted/80 backdrop-blur">
                  <button
                    type="button"
                    aria-expanded={!collapsed.has(group.name)}
                    onClick={() => toggleGroup(group.name)}
                    className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs font-semibold outline-none hover:bg-muted focus-visible:bg-muted"
                  >
                    <ChevronRightIcon
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        !collapsed.has(group.name) && "rotate-90"
                      )}
                    />
                    {tab !== "assigned" && <StatusDot color={group.color} />}
                    {group.name}
                    <span className="font-mono font-normal text-muted-foreground tabular-nums">
                      {group.items.length}
                    </span>
                  </button>
                </h2>
                {!collapsed.has(group.name) &&
                  group.items.map((item) => (
                    <Fragment key={item.key}>
                      <WorkStrip
                        item={item}
                        statuses={statuses}
                        selected={item.key === selected?.key}
                        showStatus={tab === "assigned" || Boolean(smart.ai)}
                        showAssignees={tab === "team"}
                        onSelect={() => void select(item.key)}
                      />
                      <MatchReason reason={smart.reasonOf(item.key)} />
                    </Fragment>
                  ))}
              </section>
            ))}
          </div>
        </ScrollArea>
      </main>
      {selected ? (
        <WorkItemPreview
          key={selected.key}
          item={selected}
          statuses={statuses}
          board={
            sprint?.statusFieldId
              ? { projectId: sprint.project.id, fieldId: sprint.statusFieldId }
              : null
          }
          composerRef={composerRef}
          onClose={() => void select(undefined)}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      ) : (
        <DetailPlaceholder
          title={
            flat.length > 0
              ? issueCopy.placeholder.count(flat.length)
              : issueCopy.placeholder.nothing
          }
        >
          {flat.length > 0
            ? issueCopy.placeholder.pick
            : issueCopy.placeholder.changeFilters}
        </DetailPlaceholder>
      )}
    </div>
  )
}
