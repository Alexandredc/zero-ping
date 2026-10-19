import {
  CheckCheckIcon,
  CircleDotDashedIcon,
  ClockIcon,
  GitPullRequestArrowIcon,
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

/** « Toutes les PR » and « Toutes les issues »: « Mes PR » widened to every open PR or issue. */
export const ALL_PULLS_ICON: LucideIcon = GitPullRequestArrowIcon
export const ALL_ISSUES_ICON: LucideIcon = CircleDotDashedIcon

/** What « Mes PR » lists: the viewer's PRs, or every open PR (« all ») or issue of the tracked repos. */
export type Scope = "mine" | "all" | "issues"
export const SCOPES = ["mine", "all", "issues"] as const satisfies Scope[]

export const PRIMARY_FOLDERS: Folder[] = ["review", "awaiting", "mine"]
export const SECONDARY_FOLDERS: Folder[] = ["other", "snoozed", "done"]
