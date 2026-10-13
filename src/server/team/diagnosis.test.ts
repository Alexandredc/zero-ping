import { describe, expect, it } from "vitest"
import { ballHolder, diagnose } from "./diagnosis"

const NOW = new Date("2026-10-12T12:00:00Z")

const pull = {
  author: "jdoe",
  createdAt: new Date("2026-09-20T12:00:00Z"),
  updatedAt: new Date("2026-10-09T12:00:00Z"),
  reviewers: ["lead", "team:leads"],
  problems: [] as ("no-reviewer" | "changes" | "ci" | "conflict" | "stale")[],
}

describe("diagnose", () => {
  it("gives the lead a PR nobody reviews", () => {
    const [diagnosis] = diagnose(
      { ...pull, reviewers: [], problems: ["no-reviewer"] },
      "fr",
      NOW
    )
    expect(diagnosis.holder).toEqual({ kind: "lead" })
    expect(diagnosis.nextStep).toMatch(/Prends la review/)
  })

  it("sends CI, conflicts and pending changes back to the author", () => {
    const diagnoses = diagnose(
      { ...pull, problems: ["changes", "ci", "conflict"] },
      "fr",
      NOW
    )
    expect(diagnoses.map((d) => d.holder)).toEqual([
      { kind: "author", login: "jdoe" },
      { kind: "author", login: "jdoe" },
      { kind: "author", login: "jdoe" },
    ])
    // Intl separates the number and the unit with a no-break space.
    expect(diagnoses[0].reason).toMatch(
      /^Des changements ont été demandés et rien n'a été poussé depuis 3\sj\.$/
    )
    expect(diagnoses[1].nextStep).toBe(
      "@jdoe doit la corriger avant toute review."
    )
  })

  it("points an old PR at its pending reviewers", () => {
    const [diagnosis] = diagnose({ ...pull, problems: ["stale"] }, "fr", NOW)
    expect(diagnosis.reason).toMatch(/^Ouverte depuis 3\ssem\./)
    expect(diagnosis.nextStep).toBe("Relance @lead, équipe leads.")
    expect(diagnosis.holder).toEqual({
      kind: "reviewers",
      reviewers: ["lead", "team:leads"],
    })
  })
})

describe("diagnose in English", () => {
  it("writes the reasons and next steps in English", () => {
    const diagnoses = diagnose(
      { ...pull, problems: ["changes", "ci", "stale"] },
      "en",
      NOW
    )
    expect(diagnoses[0].reason).toMatch(
      /^Changes were requested and nothing has been pushed for 3\sdays\.$/
    )
    expect(diagnoses[1].nextStep).toBe("@jdoe has to fix it before any review.")
    expect(diagnoses[2].reason).toMatch(/^Open for 3\swk\., still waiting/)
    expect(diagnoses[2].nextStep).toBe("Nudge @lead, team leads.")
  })

  it("falls back to the author when there is none", () => {
    const [diagnosis] = diagnose(
      { ...pull, author: null, reviewers: [], problems: ["stale"] },
      "en",
      NOW
    )
    expect(diagnosis.nextStep).toBe(
      "Ask the author whether it should still move forward or be closed."
    )
  })
})

describe("diagnose for the viewer", () => {
  it("tells the viewer their own review is awaited", () => {
    const [diagnosis] = diagnose(
      { ...pull, problems: ["stale"] },
      "fr",
      NOW,
      "Lead"
    )
    expect(diagnosis.nextStep).toBe(
      "Ta review est attendue : c'est à toi de jouer."
    )
  })
})

describe("ballHolder", () => {
  it("follows the most blocking problem, else the reviewers", () => {
    expect(ballHolder({ ...pull, problems: ["ci", "stale"] })).toEqual({
      kind: "author",
      login: "jdoe",
    })
    expect(ballHolder({ ...pull, problems: ["no-reviewer"] })).toEqual({
      kind: "lead",
    })
    expect(ballHolder(pull)).toEqual({
      kind: "reviewers",
      reviewers: ["lead", "team:leads"],
    })
  })
})
