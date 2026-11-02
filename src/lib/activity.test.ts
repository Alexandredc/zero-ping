import { describe, expect, it } from "vitest"
import {
  activityMeta,
  describeActivity,
  mergeActivity,
  readActivityMeta,
} from "./activity"
import { messagesFor } from "@/lib/i18n/messages"

describe("readActivityMeta", () => {
  it("reads a fixed activity on a fixed item", () => {
    expect(
      readActivityMeta(activityMeta("summary", ["acme/api#1"]), "standard")
    ).toEqual({ activity: "summary", itemKeys: ["acme/api#1"] })
  })

  it("resolves the activity and the items from the variables", () => {
    type DoneInput = { keys: string[]; done: boolean }
    const meta = activityMeta(
      (input: DoneInput) => (input.done ? "done" : "undone"),
      (input: DoneInput) => input.keys
    )
    expect(readActivityMeta(meta, { keys: ["a", "b"], done: false })).toEqual({
      activity: "undone",
      itemKeys: ["a", "b"],
    })
  })

  it("skips a mutation that is not about items", () => {
    expect(readActivityMeta(undefined, undefined)).toBeNull()
    expect(readActivityMeta({ other: true }, undefined)).toBeNull()
  })
})

describe("mergeActivity", () => {
  it("joins the server's work and this tab's, once each, in a stable order", () => {
    const merged = mergeActivity(
      { "acme/api#1": ["slackSearch", "summary"], "acme/web#2": ["triage"] },
      [
        { activity: "summary", itemKeys: ["acme/api#1"] },
        { activity: "done", itemKeys: ["acme/api#1", "acme/api#3"] },
      ]
    )
    expect(Object.fromEntries(merged)).toEqual({
      "acme/api#1": ["done", "summary", "slackSearch"],
      "acme/web#2": ["triage"],
      "acme/api#3": ["done"],
    })
  })

  it("works before the server answered", () => {
    expect(mergeActivity(undefined, []).size).toBe(0)
  })
})

describe("describeActivity", () => {
  it("names the first activity and counts the others, in French", () => {
    expect(
      describeActivity(["done", "slackSearch"], messagesFor("fr"))
    ).toEqual({
      label: "Marquage comme traité… +1",
      hint: "En cours : marquage comme traité, recherche Slack",
    })
  })

  it("speaks English", () => {
    expect(describeActivity(["summary"], messagesFor("en"))).toEqual({
      label: "AI summary…",
      hint: "In progress: AI summary",
    })
  })
})
