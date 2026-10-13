import type { Messages } from "@/lib/i18n/messages"

/** Prefix of team reviewers, so that people and teams can be told apart. */
export const TEAM_PREFIX = "team:"

/** `@lead` for a person, `équipe leads` for a team stored as `team:leads`. */
export function reviewerLabel(reviewer: string, t: Messages): string {
  return reviewer.startsWith(TEAM_PREFIX)
    ? t.team.teamReviewer(reviewer.slice(TEAM_PREFIX.length))
    : `@${reviewer}`
}
