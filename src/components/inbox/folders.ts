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

/** The icon of each folder; labels and hints live in `t.nav.folders`. */
export const FOLDER_ICONS: Record<Folder, LucideIcon> = {
  review: GitPullRequestIcon,
  awaiting: MessageCircleQuestionIcon,
  mine: RocketIcon,
  other: InboxIcon,
  snoozed: ClockIcon,
  done: CheckCheckIcon,
}

export const PRIMARY_FOLDERS: Folder[] = ["review", "awaiting", "mine"]
export const SECONDARY_FOLDERS: Folder[] = ["other", "snoozed", "done"]
