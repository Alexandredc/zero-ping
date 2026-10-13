import { describe, expect, it } from "vitest"
import { buildSlackPrompt } from "./discussions"

describe("buildSlackPrompt", () => {
  const subject = {
    repoFullName: "acme/app",
    number: 7,
    title: "Peak season",
    htmlUrl: "https://github.com/acme/app/issues/7",
  }

  it("searches an issue by its issues path", () => {
    const prompt = buildSlackPrompt({ ...subject, kind: "Issue" })
    expect(prompt).toContain("about the GitHub issue")
    expect(prompt).toContain('"app/issues/7"')
  })

  it("keeps the pull request wording by default", () => {
    expect(buildSlackPrompt(subject)).toContain('"app/pull/7"')
  })

  it("asks for steady DM names", () => {
    expect(buildSlackPrompt(subject)).toContain(
      "#dm <other participant's name>"
    )
  })
})
