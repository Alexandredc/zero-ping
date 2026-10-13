// Free of server imports: the « Mes issues » page reads the sprint's day from here.

export type Iteration = { title: string; startDate: string; duration: number }

const DAY_MS = 24 * 60 * 60 * 1000

/** The iteration that contains `today`, from the field's planned iterations. */
export function currentIteration(
  iterations: Iteration[],
  today: Date = new Date()
): Iteration | null {
  return (
    iterations.find((iteration) => {
      const start = new Date(`${iteration.startDate}T00:00:00`).getTime()
      return (
        today.getTime() >= start &&
        today.getTime() < start + iteration.duration * DAY_MS
      )
    }) ?? null
  )
}

/** Day of the sprint, from 1 to its duration. */
export function sprintDay(iteration: Iteration, today: Date = new Date()) {
  const start = new Date(`${iteration.startDate}T00:00:00`).getTime()
  const day = Math.floor((today.getTime() - start) / DAY_MS) + 1
  return Math.min(Math.max(day, 1), iteration.duration)
}
