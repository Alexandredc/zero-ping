import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  BellIcon,
  BellOffIcon,
  LaptopIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  SunIcon,
  TriangleAlertIcon,
} from "lucide-react"
import {
  ALL_ISSUES_ICON,
  ALL_PULLS_ICON,
  FOLDER_ICONS,
  PRIMARY_FOLDERS,
  SECONDARY_FOLDERS,
} from "./folders"
import type { Scope } from "./folders"
import { PAGE_ICONS } from "./pages"
import type { Folder } from "@/server/inbox/actions"
import type { SyncStatus } from "@/server/inbox/loop"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatWhen, nextMorning, timeAgo } from "@/lib/format"
import { useTheme } from "@/lib/theme"
import { LOGO_URL, formatPings } from "@/lib/pings"
import {
  browseCountsQuery,
  folderCountsQuery,
  issuesQuery,
  pingCountQuery,
  quietQuery,
  teamQuery,
  useSavePreferences,
} from "@/hooks/use-inbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DND_FOREVER, doNotDisturb, isForever } from "@/lib/quiet"
import { useNotificationPermission } from "@/hooks/use-notification-permission"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"
import { usePrefetchPages } from "@/hooks/use-prefetch-pages"
import type { Theme } from "@/lib/theme"
import { useI18n } from "@/hooks/use-i18n"
import type { Messages } from "@/lib/i18n/messages"

type SidebarProps = {
  folder?: Folder
  /** « Toutes les PR » or « Toutes les issues » is open: « Mes PR » widened to every open PR or issue. */
  browse?: Exclude<Scope, "mine"> | null
  page?: "dashboard" | "team" | "recap" | "issues"
  counts?: Record<Folder, number>
  sync?: SyncStatus
  onSync?: () => void
  syncing?: boolean
}

function FolderLink({
  folder,
  active,
  count,
  collapsed,
}: {
  folder: Folder
  active: boolean
  count?: number
  collapsed: boolean
}) {
  const { t } = useI18n()
  const meta = t.nav.folders[folder]
  const Icon = FOLDER_ICONS[folder]
  const hasCount = count !== undefined && count > 0
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to="/"
            search={{ folder }}
            aria-label={collapsed ? meta.label : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center px-0" : "px-2.5",
              active && "bg-sidebar-accent font-medium text-sidebar-foreground"
            )}
          />
        }
      >
        <Icon className="size-4 shrink-0 opacity-70" />
        {!collapsed && <span className="flex-1 truncate">{meta.label}</span>}
        {hasCount &&
          (collapsed ? (
            <span className="absolute top-0.5 right-1 font-mono text-[0.6rem] leading-none text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          ))}
      </TooltipTrigger>
      <TooltipContent side="right">
        {collapsed
          ? `${meta.label}${hasCount ? ` · ${count}` : ""}`
          : meta.hint}
      </TooltipContent>
    </Tooltip>
  )
}

/** A link to a page outside the inbox folders, styled like a folder. */
function PageLink({
  to,
  search,
  label,
  hint,
  icon: Icon,
  active,
  count,
  loading = false,
  collapsed,
}: {
  to: "/" | "/dashboard" | "/team" | "/recap" | "/issues"
  search?: { folder: Folder; scope: Exclude<Scope, "mine"> }
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  count?: number
  /** Read from GitHub for the first time: a spinner stands for the count. */
  loading?: boolean
  collapsed: boolean
}) {
  const hasCount = !loading && count !== undefined && count > 0
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={to}
            search={search}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center px-0" : "px-2.5",
              active && "bg-sidebar-accent font-medium text-sidebar-foreground"
            )}
          />
        }
      >
        <Icon className="size-4 shrink-0 opacity-70" />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {loading && (
          <Spinner
            className={cn(
              "shrink-0 text-muted-foreground",
              collapsed ? "absolute top-0.5 right-0.5 size-2.5" : "size-3"
            )}
          />
        )}
        {hasCount &&
          (collapsed ? (
            <span className="absolute top-0.5 right-1 font-mono text-[0.6rem] leading-none text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          ))}
      </TooltipTrigger>
      <TooltipContent side="right">
        {collapsed ? `${label}${hasCount ? ` · ${count}` : ""}` : hint}
      </TooltipContent>
    </Tooltip>
  )
}

const THEME_ORDER: Theme[] = ["system", "light", "dark"]
const THEME_ICONS: Record<Theme, typeof SunIcon> = {
  system: LaptopIcon,
  light: SunIcon,
  dark: MoonIcon,
}

function SectionTitle({
  children,
  collapsed,
}: {
  children: string
  collapsed: boolean
}) {
  if (collapsed) return <Separator className="my-1.5 w-6 self-center" />
  return (
    <p className="px-2.5 pt-2 pb-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground/80 uppercase">
      {children}
    </p>
  )
}

/** A sidebar action laid out like a folder link: icon, label, optional detail. */
function MenuRow({
  icon: Icon,
  label,
  detail,
  hint,
  collapsed,
  spinning,
  ...props
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  detail?: React.ReactNode
  hint: string
  collapsed: boolean
  spinning?: boolean
} & Omit<React.ComponentProps<"button">, "children">) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={collapsed ? label : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md py-1.5 text-sm text-sidebar-foreground/80 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
              collapsed ? "justify-center px-0" : "px-2.5"
            )}
            {...props}
          />
        }
      >
        {spinning ? (
          <Spinner className="size-4 shrink-0 opacity-70" />
        ) : (
          <Icon className="size-4 shrink-0 opacity-70" />
        )}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{label}</span>
            {detail && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {detail}
              </span>
            )}
          </>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{hint}</TooltipContent>
    </Tooltip>
  )
}

const dndDurations = (t: Messages) => [
  { label: t.inbox.dnd.for1Hour, until: () => new Date(Date.now() + 3600_000) },
  {
    label: t.inbox.dnd.for3Hours,
    until: () => new Date(Date.now() + 3 * 3600_000),
  },
  { label: t.inbox.dnd.untilTomorrowMorning, until: () => nextMorning() },
  {
    label: t.inbox.dnd.untilTurnedBackOn,
    until: () => new Date(DND_FOREVER),
  },
]

/** « Ne pas déranger »: mutes the notifications for a while, or shows why they are. */
function DndRow({ collapsed }: { collapsed: boolean }) {
  const { data } = useQuery(quietQuery())
  const save = useSavePreferences()
  const navigate = useNavigate()
  const { t, language } = useI18n()
  if (!data) return null
  const { muted, reason } = doNotDisturb(data)
  const detail =
    reason === "dnd" && data.dndUntil
      ? isForever(data.dndUntil)
        ? t.inbox.dnd.on
        : t.common.until(formatWhen(new Date(data.dndUntil), language))
      : reason === "quiet"
        ? t.inbox.dnd.quietUntil(data.quietEnd)
        : undefined
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <MenuRow
            icon={muted ? BellOffIcon : BellIcon}
            label={t.inbox.dnd.label}
            detail={detail}
            hint={muted ? t.inbox.dnd.mutedHint(detail) : t.inbox.dnd.muteHint}
            collapsed={collapsed}
          />
        }
      />
      <DropdownMenuContent side="right" align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.inbox.dnd.menuLabel}</DropdownMenuLabel>
          {dndDurations(t).map((option) => (
            <DropdownMenuItem
              key={option.label}
              onClick={() =>
                save.mutate({ dndUntil: option.until().toISOString() })
              }
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {reason === "dnd" && (
            <DropdownMenuItem onClick={() => save.mutate({ dndUntil: null })}>
              {t.inbox.dnd.turnBackOn}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() =>
              void navigate({
                to: "/settings",
                search: { section: "notifications" },
              })
            }
          >
            {t.inbox.dnd.quietHours}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The logo with the number of items waiting for the viewer in its corner. */
function LogoWithPings() {
  const { data: count = 0 } = useQuery(pingCountQuery())
  const { t } = useI18n()
  return (
    <span className="relative shrink-0">
      <img src={LOGO_URL} alt="" className="size-8" />
      {count > 0 && (
        <span
          aria-label={t.inbox.sidebar.pings(count)}
          className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 font-mono text-[0.65rem] font-bold text-white tabular-nums ring-2 ring-sidebar"
        >
          {formatPings(count)}
        </span>
      )}
    </span>
  )
}

export function Sidebar({
  folder,
  browse = null,
  page,
  counts,
  sync,
  onSync,
  syncing,
}: SidebarProps) {
  const running = Boolean(syncing || sync?.running)
  const { collapsed, toggle } = useSidebarCollapsed()
  const { theme, setTheme } = useTheme()
  const { permission, request } = useNotificationPermission()
  const navigate = useNavigate()
  const { t, language } = useI18n()
  const copy = t.inbox.sidebar
  const { data: team } = useQuery(teamQuery())
  const { data: issues } = useQuery(issuesQuery())
  // The inbox passes its own counts; the other pages load them here.
  const { data: ownCounts } = useQuery({
    ...folderCountsQuery(),
    enabled: !counts,
  })
  const folderCounts = counts ?? ownCounts
  const { data: browseCounts } = useQuery(browseCountsQuery())
  useHotkeys({ "[": toggle })
  usePrefetchPages()

  const nextTheme =
    THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
  const syncDetail = running
    ? copy.syncRunning
    : sync?.lastSyncAt
      ? timeAgo(sync.lastSyncAt, language)
      : copy.syncSoon

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-sidebar py-3 transition-[width] duration-200",
        collapsed ? "w-14 px-2" : "w-56 px-2.5"
      )}
    >
      <Link
        to="/"
        search={{ folder: "review" }}
        aria-label="Zéro Ping"
        className={cn(
          "mb-2 flex items-center gap-2.5 rounded-md pt-1 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "justify-center" : "px-1"
        )}
      >
        <LogoWithPings />
        {!collapsed && (
          <span className="font-heading text-base leading-tight font-semibold tracking-tight">
            Zéro Ping
          </span>
        )}
      </Link>

      <nav className="flex flex-col gap-0.5" aria-label={copy.folders}>
        <SectionTitle collapsed={collapsed}>{copy.sections.lead}</SectionTitle>
        <PageLink
          to="/dashboard"
          label={t.nav.pages.dashboard}
          hint={copy.pageHints.dashboard}
          icon={PAGE_ICONS.dashboard}
          active={page === "dashboard"}
          collapsed={collapsed}
        />
        <PageLink
          to="/team"
          label={t.nav.pages.team}
          hint={copy.pageHints.team}
          icon={PAGE_ICONS.team}
          active={page === "team"}
          count={team?.pulls.filter((pull) => pull.problems.length > 0).length}
          collapsed={collapsed}
        />
        <PageLink
          to="/recap"
          label={t.nav.pages.recap}
          hint={copy.pageHints.recap}
          icon={PAGE_ICONS.recap}
          active={page === "recap"}
          collapsed={collapsed}
        />
        <SectionTitle collapsed={collapsed}>{copy.sections.todo}</SectionTitle>
        {PRIMARY_FOLDERS.map((f) => (
          <FolderLink
            key={f}
            folder={f}
            active={f === folder && !(f === "mine" && browse)}
            count={folderCounts?.[f]}
            collapsed={collapsed}
          />
        ))}
        <PageLink
          to="/issues"
          label={t.nav.pages.issues}
          hint={copy.pageHints.issues}
          icon={PAGE_ICONS.issues}
          active={page === "issues"}
          count={issues?.assigned.length}
          collapsed={collapsed}
        />
        <SectionTitle collapsed={collapsed}>
          {copy.sections.browse}
        </SectionTitle>
        <PageLink
          to="/"
          search={{ folder: "mine", scope: "all" }}
          label={t.inbox.list.allPulls}
          hint={t.inbox.list.allPullsHint}
          icon={ALL_PULLS_ICON}
          active={browse === "all"}
          count={browseCounts?.pulls}
          loading={browseCounts?.pullsLoading}
          collapsed={collapsed}
        />
        <PageLink
          to="/"
          search={{ folder: "mine", scope: "issues" }}
          label={t.inbox.list.allIssues}
          hint={t.inbox.list.allIssuesHint}
          icon={ALL_ISSUES_ICON}
          active={browse === "issues"}
          count={browseCounts?.issues ?? undefined}
          loading={browseCounts?.issues === null}
          collapsed={collapsed}
        />
        <SectionTitle collapsed={collapsed}>{copy.sections.filed}</SectionTitle>
        {SECONDARY_FOLDERS.map((f) => (
          <FolderLink
            key={f}
            folder={f}
            active={f === folder}
            count={f === "snoozed" ? folderCounts?.[f] : undefined}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <nav className="mt-auto flex flex-col gap-0.5" aria-label={copy.app}>
        {sync?.lastError &&
          (collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="flex justify-center py-1.5 text-destructive"
                    aria-label={sync.lastError}
                  />
                }
              >
                <TriangleAlertIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">{sync.lastError}</TooltipContent>
            </Tooltip>
          ) : (
            <p className="mb-1 flex gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              {sync.lastError}
            </p>
          ))}
        <SectionTitle collapsed={collapsed}>{copy.sections.app}</SectionTitle>
        {permission === "default" && (
          <MenuRow
            icon={BellIcon}
            label={copy.enableNotifications}
            hint={copy.enableNotificationsHint}
            collapsed={collapsed}
            onClick={() => void request()}
          />
        )}
        {permission === "granted" && <DndRow collapsed={collapsed} />}
        {onSync && (
          <MenuRow
            icon={RefreshCwIcon}
            label={copy.sync}
            detail={syncDetail}
            hint={running ? copy.syncRunningHint : copy.syncHint(syncDetail)}
            collapsed={collapsed}
            spinning={running}
            disabled={running}
            onClick={onSync}
          />
        )}
        <MenuRow
          icon={THEME_ICONS[theme]}
          label={copy.theme}
          detail={copy.themes[theme]}
          hint={copy.themeHint(copy.themes[theme], copy.themes[nextTheme])}
          collapsed={collapsed}
          onClick={() => setTheme(nextTheme)}
        />
        <MenuRow
          icon={PAGE_ICONS.settings}
          label={t.nav.pages.settings}
          hint={copy.pageHints.settings}
          collapsed={collapsed}
          onClick={() => void navigate({ to: "/settings" })}
        />
        <MenuRow
          icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
          label={copy.collapse}
          hint={collapsed ? copy.expandHint : copy.collapseHint}
          collapsed={collapsed}
          onClick={toggle}
        />
      </nav>
    </aside>
  )
}
