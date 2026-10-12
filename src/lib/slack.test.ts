import { describe, expect, it } from "vitest"
import { slackToMarkdown } from "./slack"

describe("slackToMarkdown", () => {
  it("rewrites links, mentions and channels", () => {
    expect(
      slackToMarkdown(
        "<https://github.com/acme/api/pull/8|acme/api#8> for <@U08PDQ|Meirkhan> in <#C123|pull-requests>, <!here>"
      )
    ).toBe(
      "[acme/api#8](https://github.com/acme/api/pull/8) for @Meirkhan in #pull-requests, @here"
    )
  })

  it("keeps bare links clickable", () => {
    expect(slackToMarkdown("see <https://example.com/a>")).toBe(
      "see <https://example.com/a>"
    )
  })

  it("maps Slack emphasis and unescapes entities", () => {
    expect(slackToMarkdown("*UI* is ~done~ &gt; ok &amp; shipped")).toBe(
      "**UI** is ~~done~~ > ok & shipped"
    )
  })

  it("leaves code-like asterisks alone", () => {
    expect(slackToMarkdown("a*b*c")).toBe("a*b*c")
  })
})
