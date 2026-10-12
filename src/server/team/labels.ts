import type { TeamProblem } from "@/server/db/schema"

export const TEAM_PROBLEM_LABEL: Record<TeamProblem, string> = {
  "no-reviewer": "Sans reviewer",
  changes: "Changements en attente",
  ci: "CI en échec",
  conflict: "En conflit",
  stale: "Ouverte depuis longtemps",
}
