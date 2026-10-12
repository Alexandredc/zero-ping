import type { TeamProblem } from "@/server/db/schema"
import { TEAM_PREFIX } from "@/server/team/labels"

export type Weather = "sunny" | "cloudy" | "stormy"

export type PersonWeather = {
  login: string
  isViewer: boolean
  /** Open PRs by others where this person's review is requested. */
  reviewsDue: number
  /** Their open, non-draft PRs. */
  openPulls: number
  /** Their PRs that do not move, by problem. */
  blocked: { number: number; problems: TeamProblem[] }[]
  /** Reviewers their PRs are waiting on. */
  waitingOn: string[]
  weather: Weather
}

type Pull = {
  number: number
  author: string | null
  isDraft: boolean
  reviewers: string[]
  problems: TeamProblem[]
}

const REVIEWS_BUSY = 3
const REVIEWS_OVERLOADED = 6

export function weatherFor(reviewsDue: number, blocked: number): Weather {
  if (blocked >= 2 || reviewsDue >= REVIEWS_OVERLOADED) return "stormy"
  if (blocked === 1 || reviewsDue >= REVIEWS_BUSY) return "cloudy"
  return "sunny"
}

/**
 * One row per teammate from the team's open PRs, plus the viewer from their
 * own inbox counts. Busiest and most blocked first.
 */
export function teamWeather(
  pulls: Pull[],
  viewer: {
    login: string
    reviewsDue: number
    openPulls: number
    blocked: number
  }
): PersonWeather[] {
  const people = new Map<string, PersonWeather>()
  const person = (login: string) => {
    const key = login.toLowerCase()
    let row = people.get(key)
    if (!row) {
      row = {
        login,
        isViewer: key === viewer.login.toLowerCase(),
        reviewsDue: 0,
        openPulls: 0,
        blocked: [],
        waitingOn: [],
        weather: "sunny",
      }
      people.set(key, row)
    }
    return row
  }

  for (const pull of pulls) {
    const humans = pull.reviewers.filter((r) => !r.startsWith(TEAM_PREFIX))
    if (!pull.isDraft)
      for (const reviewer of humans) person(reviewer).reviewsDue += 1
    if (!pull.author || pull.isDraft) continue
    const author = person(pull.author)
    author.openPulls += 1
    if (pull.problems.length > 0)
      author.blocked.push({ number: pull.number, problems: pull.problems })
    for (const reviewer of pull.reviewers)
      if (!author.waitingOn.includes(reviewer)) author.waitingOn.push(reviewer)
  }

  // The team PRs leave out the viewer's own: their inbox knows them better.
  const self = person(viewer.login)
  self.reviewsDue = viewer.reviewsDue
  self.openPulls = viewer.openPulls

  const rows = [...people.values()].map((row) => ({
    ...row,
    weather: weatherFor(
      row.reviewsDue,
      row.isViewer ? viewer.blocked : row.blocked.length
    ),
  }))
  const rank = { stormy: 0, cloudy: 1, sunny: 2 }
  return rows.sort(
    (a, b) =>
      rank[a.weather] - rank[b.weather] ||
      b.blocked.length - a.blocked.length ||
      b.reviewsDue - a.reviewsDue ||
      a.login.localeCompare(b.login)
  )
}
