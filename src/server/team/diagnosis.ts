import type { TeamProblem, TeamPull } from "@/server/db/schema"
import { elapsed } from "@/lib/format"
import type { Language } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"
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

function holderFor(problem: TeamProblem, pull: Input): BallHolder {
  switch (problem) {
    case "no-reviewer":
      return { kind: "lead" }
    case "changes":
    case "ci":
    case "conflict":
      return { kind: "author", login: pull.author }
    case "stale":
      return pull.reviewers.length > 0
        ? { kind: "reviewers", reviewers: pull.reviewers }
        : { kind: "author", login: pull.author }
  }
}

export function diagnose(
  pull: Input,
  language: Language,
  now: Date = new Date(),
  viewerLogin?: string
): Diagnosis[] {
  const t = messagesFor(language)
  const { diagnosis } = t.team
  const isViewer = (login: string) =>
    login.toLowerCase() === viewerLogin?.toLowerCase()
  const author = pull.author ? `@${pull.author}` : t.team.theAuthor
  return pull.problems.map((problem): Diagnosis => {
    const holder = holderFor(problem, pull)
    switch (problem) {
      case "no-reviewer":
        return { problem, holder, ...diagnosis.noReviewer }
      case "changes":
        return {
          problem,
          holder,
          reason: diagnosis.changes.reason(
            elapsed(pull.updatedAt, language, now)
          ),
          nextStep: diagnosis.changes.nextStep(author),
        }
      case "ci":
        return {
          problem,
          holder,
          reason: diagnosis.ci.reason,
          nextStep: diagnosis.ci.nextStep(author),
        }
      case "conflict":
        return {
          problem,
          holder,
          reason: diagnosis.conflict.reason,
          nextStep: diagnosis.conflict.nextStep(author),
        }
      case "stale": {
        const age = elapsed(pull.createdAt, language, now)
        const others = pull.reviewers.filter((r) => !isViewer(r))
        if (pull.reviewers.length > 0)
          return {
            problem,
            holder,
            reason: diagnosis.stale.waitingReason(age),
            nextStep:
              others.length < pull.reviewers.length
                ? diagnosis.stale.yourTurn
                : diagnosis.stale.nudge(
                    others.map((r) => reviewerLabel(r, t)).join(", ")
                  ),
          }
        return {
          problem,
          holder,
          reason: diagnosis.stale.reason(age),
          nextStep: diagnosis.stale.askAuthor(author),
        }
      }
    }
  })
}

/** The PR's most blocking problem decides who holds the ball. */
export function ballHolder(pull: Input): BallHolder {
  const first = pull.problems.at(0)
  if (first) return holderFor(first, pull)
  return pull.reviewers.length > 0
    ? { kind: "reviewers", reviewers: pull.reviewers }
    : { kind: "author", login: pull.author }
}
