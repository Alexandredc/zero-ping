import {
  CheckCheckIcon,
  ClockIcon,
  GitPullRequestIcon,
  InboxIcon,
  MessageCircleQuestionIcon,
  RocketIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Folder } from "@/server/inbox/actions"

export const FOLDER_META: Record<
  Folder,
  { label: string; hint: string; icon: LucideIcon }
> = {
  review: {
    label: "À reviewer",
    hint: "PR ouvertes où ta review est demandée",
    icon: GitPullRequestIcon,
  },
  awaiting: {
    label: "On t'attend",
    hint: "Mentions et fils où tu n'as pas encore répondu (ceux de tes PR restent dans « Mes PR »)",
    icon: MessageCircleQuestionIcon,
  },
  mine: {
    label: "Mes PR",
    hint: "Toutes tes PR ouvertes, brouillons compris : réponses, retours, CI, prêtes à merger",
    icon: RocketIcon,
  },
  other: {
    label: "Le reste",
    hint: "Notifications sans action attendue de ta part",
    icon: InboxIcon,
  },
  snoozed: {
    label: "En pause",
    hint: "Reviendront à l'heure choisie",
    icon: ClockIcon,
  },
  done: {
    label: "Traités",
    hint: "Reviennent s'il y a du nouveau",
    icon: CheckCheckIcon,
  },
}

export const PRIMARY_FOLDERS: Folder[] = ["review", "awaiting", "mine"]
export const SECONDARY_FOLDERS: Folder[] = ["other", "snoozed", "done"]
