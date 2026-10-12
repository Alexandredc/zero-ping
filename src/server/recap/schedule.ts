/** `YYYY-MM-DD` in the machine's time zone, the day a recap belongs to. */
export function localDate(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isWorkingDay(now: Date): boolean {
  const day = now.getDay()
  return day !== 0 && day !== 6
}

/**
 * The recap is due once per working day, at the chosen time or at the first
 * check after it when the app was not running then.
 */
export function isRecapDue(
  now: Date,
  time: string,
  lastDate: string | null
): boolean {
  if (!isWorkingDay(now) || lastDate === localDate(now)) return false
  const [hours, minutes] = time.split(":").map(Number)
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes
}
