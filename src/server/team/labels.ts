import type { TeamProblem } from "@/server/db/schema"

export const TEAM_PROBLEM_LABEL: Record<TeamProblem, string> = {
  "no-reviewer": "Sans reviewer",
  changes: "Changements en attente",
  ci: "CI en échec",
  conflict: "En conflit",
  stale: "Ouverte depuis longtemps",
}

/** Prefix of team reviewers, so that people and teams can be told apart. */
export const TEAM_PREFIX = "team:"

/** `@lead` for a person, `équipe leads` for a team stored as `team:leads`. */
export function reviewerLabel(reviewer: string): string {
  return reviewer.startsWith(TEAM_PREFIX)
    ? `équipe ${reviewer.slice(TEAM_PREFIX.length)}`
    : `@${reviewer}`
}
