import { describe, expect, it } from "vitest"
import { isRecapDue, localDate } from "./schedule"

// Local times: the recap follows the machine's clock.
const monday = (hours: number, minutes = 0) =>
  new Date(2026, 9, 12, hours, minutes)

describe("isRecapDue", () => {
  it("waits for the chosen time", () => {
    expect(isRecapDue(monday(9, 4), "09:05", null)).toBe(false)
    expect(isRecapDue(monday(9, 5), "09:05", null)).toBe(true)
  })

  it("catches up later in the day when the app was off", () => {
    expect(isRecapDue(monday(14), "09:05", "2026-10-09")).toBe(true)
  })

  it("runs once a day", () => {
    expect(isRecapDue(monday(14), "09:05", localDate(monday(9)))).toBe(false)
  })

  it("skips weekends", () => {
    expect(isRecapDue(new Date(2026, 9, 11, 10), "09:05", null)).toBe(false)
  })
})
