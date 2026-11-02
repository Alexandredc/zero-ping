import { describe, expect, it } from "vitest"
import { activitySnapshot, beginActivity, trackActivity } from "./activity"

describe("item activity", () => {
  it("lists what runs on each item until it ends", () => {
    const endSummary = beginActivity("acme/api#1", "summary")
    const endSearch = beginActivity("acme/api#1", "slackSearch")
    const endTriage = beginActivity("acme/web#2", "triage")
    expect(activitySnapshot()).toEqual({
      "acme/api#1": ["summary", "slackSearch"],
      "acme/web#2": ["triage"],
    })

    endSummary()
    endTriage()
    expect(activitySnapshot()).toEqual({ "acme/api#1": ["slackSearch"] })
    endSearch()
    expect(activitySnapshot()).toEqual({})
  })

  it("keeps an activity while another run of it goes on", () => {
    const first = beginActivity("acme/api#3", "insights")
    const second = beginActivity("acme/api#3", "insights")
    first()
    // Ending twice must not end the other run.
    first()
    expect(activitySnapshot()["acme/api#3"]).toEqual(["insights"])
    second()
    expect(activitySnapshot()["acme/api#3"]).toBeUndefined()
  })

  it("ends a tracked run when it fails", async () => {
    let during: string[] | undefined
    await expect(
      trackActivity("acme/api#4", "triage", () => {
        during = activitySnapshot()["acme/api#4"]
        return Promise.reject(new Error("Jev down"))
      })
    ).rejects.toThrow("Jev down")
    expect(during).toEqual(["triage"])
    expect(activitySnapshot()["acme/api#4"]).toBeUndefined()
  })

  it("returns the tracked work's result", async () => {
    await expect(
      trackActivity("acme/api#5", "summary", () => Promise.resolve(42))
    ).resolves.toBe(42)
  })
})
