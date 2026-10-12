import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  BellIcon,
  LaptopIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  RefreshCwIcon,
  SettingsIcon,
  SunIcon,
  TriangleAlertIcon,
  UsersIcon,
  SunriseIcon,
} from "lucide-react"
import { FOLDER_META, PRIMARY_FOLDERS, SECONDARY_FOLDERS } from "./folders"
import type { Folder } from "@/server/inbox/actions"
import type { SyncStatus } from "@/server/inbox/loop"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import { useTheme } from "@/lib/theme"
import { LOGO_URL, formatPings } from "@/lib/pings"
import { pingCountQuery, teamQuery } from "@/hooks/use-inbox"
import { useNotificationPermission } from "@/hooks/use-notification-permission"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"
import type { Theme } from "@/lib/theme"

type SidebarProps = {
  folder?: Folder
  page?: "team" | "recap"
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
  const meta = FOLDER_META[folder]
  const Icon = meta.icon
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
  label,
  hint,
  icon: Icon,
  active,
  count,
  collapsed,
}: {
  to: "/team" | "/recap"
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  count?: number
  collapsed: boolean
}) {
  const hasCount = count !== undefined && count > 0
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={to}
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
const THEME_META: Record<Theme, { label: string; icon: typeof SunIcon }> = {
  system: { label: "Système", icon: LaptopIcon },
  light: { label: "Clair", icon: SunIcon },
  dark: { label: "Sombre", icon: MoonIcon },
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

/** The logo with the number of items waiting for the viewer in its corner. */
function LogoWithPings() {
  const { data: count = 0 } = useQuery(pingCountQuery())
  return (
    <span className="relative shrink-0">
      <img src={LOGO_URL} alt="" className="size-8" />
      {count > 0 && (
        <span
          aria-label={`${count} élément${count > 1 ? "s" : ""} en attente`}
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
  const { data: team } = useQuery(teamQuery())
  useHotkeys({ "[": toggle })

  const nextTheme =
    THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
  const syncDetail = running
    ? "en cours"
    : sync?.lastSyncAt
      ? timeAgo(sync.lastSyncAt)
      : "bientôt"

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-sidebar py-3 transition-[width] duration-200",
        collapsed ? "w-14 px-2" : "w-52 px-2.5"
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

      <nav className="flex flex-col gap-0.5" aria-label="Dossiers">
        <SectionTitle collapsed={collapsed}>À traiter</SectionTitle>
        {PRIMARY_FOLDERS.map((f) => (
          <FolderLink
            key={f}
            folder={f}
            active={f === folder}
            count={counts?.[f]}
            collapsed={collapsed}
          />
        ))}
        <SectionTitle collapsed={collapsed}>Classement</SectionTitle>
        {SECONDARY_FOLDERS.map((f) => (
          <FolderLink
            key={f}
            folder={f}
            active={f === folder}
            count={f === "snoozed" ? counts?.[f] : undefined}
            collapsed={collapsed}
          />
        ))}
        <SectionTitle collapsed={collapsed}>Lead</SectionTitle>
        <PageLink
          to="/team"
          label="Équipe"
          hint="PR des repos suivis sans reviewer, bloquées ou trop anciennes"
          icon={UsersIcon}
          active={page === "team"}
          count={team?.pulls.length}
          collapsed={collapsed}
        />
        <PageLink
          to="/recap"
          label="Récap du jour"
          hint="Ce qui t'attend ce matin et le standup de l'équipe"
          icon={SunriseIcon}
          active={page === "recap"}
          collapsed={collapsed}
        />
      </nav>

      <nav className="mt-auto flex flex-col gap-0.5" aria-label="Application">
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
        <SectionTitle collapsed={collapsed}>Application</SectionTitle>
        {permission === "default" && (
          <MenuRow
            icon={BellIcon}
            label="Activer les notifications"
            hint="Autorise le navigateur à te prévenir quand quelque chose t'attend"
            collapsed={collapsed}
            onClick={() => void request()}
          />
        )}
        {onSync && (
          <MenuRow
            icon={RefreshCwIcon}
            label="Sync"
            detail={syncDetail}
            hint={
              running
                ? "Synchronisation avec GitHub en cours"
                : `Interroger GitHub maintenant (dernière synchro : ${syncDetail}). Sinon, c'est automatique chaque minute.`
            }
            collapsed={collapsed}
            spinning={running}
            disabled={running}
            onClick={onSync}
          />
        )}
        <MenuRow
          icon={THEME_META[theme].icon}
          label="Thème"
          detail={THEME_META[theme].label}
          hint={`Thème ${THEME_META[theme].label.toLowerCase()} · cliquer pour passer en ${THEME_META[nextTheme].label.toLowerCase()}`}
          collapsed={collapsed}
          onClick={() => setTheme(nextTheme)}
        />
        <MenuRow
          icon={SettingsIcon}
          label="Réglages"
          hint="Repos, classement, récap, Slack, agent IA et notifications"
          collapsed={collapsed}
          onClick={() => void navigate({ to: "/settings" })}
        />
        <MenuRow
          icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
          label="Replier"
          detail={<Kbd>[</Kbd>}
          hint={
            collapsed
              ? "Déplier la barre latérale ( [ )"
              : "Replier la barre latérale ( [ )"
          }
          collapsed={collapsed}
          onClick={toggle}
        />
      </nav>
    </aside>
  )
}
