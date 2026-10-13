import {
  CircleDotIcon,
  GaugeIcon,
  SettingsIcon,
  SunriseIcon,
  UsersIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/** Pages outside the inbox folders: one icon, shared by the sidebar and the page titles; labels live in `t.nav.pages`. */
export const PAGE_ICONS = {
  dashboard: GaugeIcon,
  team: UsersIcon,
  recap: SunriseIcon,
  issues: CircleDotIcon,
  settings: SettingsIcon,
} satisfies Record<string, LucideIcon>
