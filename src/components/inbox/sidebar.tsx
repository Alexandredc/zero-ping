import { Link } from "@tanstack/react-router"
import {
  LaptopIcon,
  MoonIcon,
  RefreshCwIcon,
  SettingsIcon,
  SunIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { FOLDER_META, PRIMARY_FOLDERS, SECONDARY_FOLDERS } from "./folders"
import type { Folder } from "@/server/inbox/actions"
import type { SyncStatus } from "@/server/inbox/loop"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import { useTheme } from "@/lib/theme"
import type { Theme } from "@/lib/theme"

type SidebarProps = {
  folder?: Folder
  counts?: Record<Folder, number>
  sync?: SyncStatus
  onSync?: () => void
  syncing?: boolean
}

function FolderLink({
  folder,
  active,
  count,
}: {
  folder: Folder
  active: boolean
  count?: number
}) {
  const meta = FOLDER_META[folder]
  const Icon = meta.icon
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to="/"
            search={{ folder }}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-foreground"
            )}
          />
        }
      >
        <Icon className="size-4 shrink-0 opacity-70" />
        <span className="flex-1 truncate">{meta.label}</span>
        {count !== undefined && count > 0 && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">{meta.hint}</TooltipContent>
    </Tooltip>
  )
}

function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  return (
    <ToggleGroup
      value={[theme]}
      onValueChange={(value) => value[0] && setTheme(value[0] as Theme)}
      variant="outline"
      size="sm"
      aria-label="Thème"
    >
      <ToggleGroupItem value="light" aria-label="Clair">
        <SunIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="Système">
        <LaptopIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Sombre">
        <MoonIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function Sidebar({
  folder,
  counts,
  sync,
  onSync,
  syncing,
}: SidebarProps) {
  const running = syncing || sync?.running
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-4 border-r bg-sidebar p-3">
      <div className="px-2.5 pt-1">
        <p className="font-heading text-lg font-semibold tracking-tight">
          Triage
        </p>
        <p className="text-xs text-muted-foreground">
          Ce qui t'attend sur GitHub
        </p>
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Dossiers">
        {PRIMARY_FOLDERS.map((f) => (
          <FolderLink
            key={f}
            folder={f}
            active={f === folder}
            count={counts?.[f]}
          />
        ))}
        <Separator className="my-2" />
        {SECONDARY_FOLDERS.map((f) => (
          <FolderLink
            key={f}
            folder={f}
            active={f === folder}
            count={f === "snoozed" ? counts?.[f] : undefined}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {sync?.lastError && (
          <p className="flex gap-1.5 px-2.5 text-xs text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            {sync.lastError}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 px-2.5">
          <span className="text-xs text-muted-foreground">
            {running
              ? "Synchronisation…"
              : sync?.lastSyncAt
                ? `Synchronisé ${timeAgo(sync.lastSyncAt)}`
                : "Première synchronisation…"}
          </span>
          {onSync && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onSync}
                    disabled={running}
                    aria-label="Synchroniser maintenant"
                  />
                }
              >
                {running ? <Spinner /> : <RefreshCwIcon />}
              </TooltipTrigger>
              <TooltipContent>Synchroniser maintenant</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <ThemeSwitch />
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/settings" />}
          >
            <SettingsIcon data-icon="inline-start" />
            Repos
          </Button>
        </div>
      </div>
    </aside>
  )
}
