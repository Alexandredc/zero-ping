import {
  CircleDotIcon,
  GaugeIcon,
  SettingsIcon,
  SunriseIcon,
  UsersIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/** Pages outside the inbox folders: one label and icon, shared by the sidebar and the page titles. */
export const PAGE_META = {
  dashboard: { label: "Vue d'ensemble", icon: GaugeIcon },
  team: { label: "Équipe", icon: UsersIcon },
  recap: { label: "Récap du jour", icon: SunriseIcon },
  issues: { label: "Mes issues", icon: CircleDotIcon },
  settings: { label: "Réglages", icon: SettingsIcon },
} satisfies Record<string, { label: string; icon: LucideIcon }>
