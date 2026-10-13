import { describe, expect, it } from "vitest"
import { messagesFor } from "../messages"

const fr = messagesFor("fr").settings
const en = messagesFor("en").settings

describe("settings messages", () => {
  it("names the language section in each language", () => {
    expect(fr.language.title).toBe("Langue")
    expect(en.language.title).toBe("Language")
  })

  it("pluralises the tracked repos and Slack threads", () => {
    expect(fr.repos.trackedCount(1, 4)).toBe("1 suivi sur 4")
    expect(fr.repos.trackedCount(2, 4)).toBe("2 suivis sur 4")
    expect(en.repos.trackedCount(2, 4)).toBe("2 tracked out of 4")
    expect(fr.slack.threads(1)).toBe("1 fil")
    expect(fr.slack.threads(3)).toBe("3 fils")
    expect(en.slack.threads(1)).toBe("1 thread")
    expect(en.slack.threads(3)).toBe("3 threads")
  })

  it("mentions the standup channel only when there is one", () => {
    expect(fr.recap.teamStandupDescription("standup")).toContain(
      "dans le fil du jour de #standup."
    )
    expect(fr.recap.teamStandupDescription("")).toContain(
      "dans le fil du jour."
    )
    expect(en.recap.teamStandupDescription("standup")).toContain(
      "to the day's thread in #standup."
    )
    expect(en.recap.teamStandupDescription("")).toContain(
      "to the day's thread."
    )
  })

  it("shows GitHub's pace only when it is known", () => {
    expect(fr.sync.autoDescription(60)).toContain("(en ce moment 60 s)")
    expect(en.sync.autoDescription(60)).toContain("(currently 60 s)")
    expect(en.sync.autoDescription(null)).not.toContain("currently")
  })

  it("keeps the inline code of rich messages in place", () => {
    expect(en.agent.connectionsDescription(".env", "gh")).toEqual([
      "These values come from ",
      ".env",
      " and the ",
      "gh",
      " CLI: change them there, then restart the app.",
    ])
  })
})
