import type { TeamProblem, TeamPull } from "@/server/db/schema"
import { timeAgo } from "@/lib/format"
import { reviewerLabel } from "./labels"

/** Who has to move for the PR to go forward. */
export type BallHolder =
  | { kind: "lead" }
  | { kind: "author"; login: string | null }
  | { kind: "reviewers"; reviewers: string[] }

export type Diagnosis = {
  problem: TeamProblem
  /** What is wrong, in one sentence. */
  reason: string
  /** What should happen next, and by whom. */
  nextStep: string
  holder: BallHolder
}

type Input = Pick<
  TeamPull,
  "author" | "createdAt" | "updatedAt" | "reviewers" | "problems"
>

/** Drops the "il y a" so that durations read in a sentence: "depuis 3 j". */
const since = (date: Date, now: Date) =>
  timeAgo(date, now).replace(/^il y a /, "")

export function diagnose(
  pull: Input,
  now: Date = new Date(),
  viewerLogin?: string
): Diagnosis[] {
  const isViewer = (login: string) =>
    login.toLowerCase() === viewerLogin?.toLowerCase()
  const author = pull.author ? `@${pull.author}` : "l'auteur"
  const toAuthor: BallHolder = { kind: "author", login: pull.author }
  return pull.problems.map((problem): Diagnosis => {
    switch (problem) {
      case "no-reviewer":
        return {
          problem,
          reason: "Personne n'est désigné pour la reviewer.",
          nextStep: "Prends la review ou assigne quelqu'un avec « Reviewers ».",
          holder: { kind: "lead" },
        }
      case "changes":
        return {
          problem,
          reason: `Des changements ont été demandés et rien n'a été poussé depuis ${since(pull.updatedAt, now)}.`,
          nextStep: `Relance ${author} : il lui reste des retours à traiter.`,
          holder: toAuthor,
        }
      case "ci":
        return {
          problem,
          reason: "La CI du dernier commit échoue.",
          nextStep: `${author} doit la corriger avant toute review.`,
          holder: toAuthor,
        }
      case "conflict":
        return {
          problem,
          reason: "La branche est en conflit avec la base.",
          nextStep: `${author} doit la rebaser ou résoudre les conflits.`,
          holder: toAuthor,
        }
      case "stale": {
        const age = since(pull.createdAt, now)
        const others = pull.reviewers.filter((r) => !isViewer(r))
        if (pull.reviewers.length > 0)
          return {
            problem,
            reason: `Ouverte depuis ${age}, toujours en attente de review.`,
            nextStep:
              others.length < pull.reviewers.length
                ? "Ta review est attendue : c'est à toi de jouer."
                : `Relance ${others.map(reviewerLabel).join(", ")}.`,
            holder: { kind: "reviewers", reviewers: pull.reviewers },
          }
        return {
          problem,
          reason: `Ouverte depuis ${age}.`,
          nextStep: `Demande à ${author} si elle doit encore avancer ou être fermée.`,
          holder: toAuthor,
        }
      }
    }
  })
}

/** The PR's most blocking problem decides who holds the ball. */
export function ballHolder(
  pull: Input,
  now: Date = new Date(),
  viewerLogin?: string
): BallHolder {
  const first = diagnose(pull, now, viewerLogin).at(0)
  if (first) return first.holder
  return pull.reviewers.length > 0
    ? { kind: "reviewers", reviewers: pull.reviewers }
    : { kind: "author", login: pull.author }
}
