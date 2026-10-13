import { describe, expect, it } from "vitest"
import { ballHolder, diagnose } from "./diagnosis"

const NOW = new Date("2026-10-12T12:00:00Z")

const pull = {
  author: "robin",
  createdAt: new Date("2026-09-20T12:00:00Z"),
  updatedAt: new Date("2026-10-09T12:00:00Z"),
  reviewers: ["lead", "team:leads"],
  problems: [] as ("no-reviewer" | "changes" | "ci" | "conflict" | "stale")[],
}

describe("diagnose", () => {
  it("gives the lead a PR nobody reviews", () => {
    const [diagnosis] = diagnose(
      { ...pull, reviewers: [], problems: ["no-reviewer"] },
      NOW
    )
    expect(diagnosis.holder).toEqual({ kind: "lead" })
    expect(diagnosis.nextStep).toMatch(/Prends la review/)
  })

  it("sends CI, conflicts and pending changes back to the author", () => {
    const diagnoses = diagnose(
      { ...pull, problems: ["changes", "ci", "conflict"] },
      NOW
    )
    expect(diagnoses.map((d) => d.holder)).toEqual([
      { kind: "author", login: "robin" },
      { kind: "author", login: "robin" },
      { kind: "author", login: "robin" },
    ])
    // Intl separates the number and the unit with a no-break space.
    expect(diagnoses[0].reason).toMatch(
      /^Des changements ont été demandés et rien n'a été poussé depuis 3\sj\.$/
    )
    expect(diagnoses[1].nextStep).toBe(
      "@robin doit la corriger avant toute review."
    )
  })

  it("points an old PR at its pending reviewers", () => {
    const [diagnosis] = diagnose({ ...pull, problems: ["stale"] }, NOW)
    expect(diagnosis.reason).toMatch(/^Ouverte depuis 3\ssem\./)
    expect(diagnosis.nextStep).toBe("Relance @lead, équipe leads.")
    expect(diagnosis.holder).toEqual({
      kind: "reviewers",
      reviewers: ["lead", "team:leads"],
    })
  })
})

describe("diagnose for the viewer", () => {
  it("tells the viewer their own review is awaited", () => {
    const [diagnosis] = diagnose({ ...pull, problems: ["stale"] }, NOW, "Lead")
    expect(diagnosis.nextStep).toBe(
      "Ta review est attendue : c'est à toi de jouer."
    )
  })
})

describe("ballHolder", () => {
  it("follows the most blocking problem, else the reviewers", () => {
    expect(ballHolder({ ...pull, problems: ["ci", "stale"] }, NOW)).toEqual({
      kind: "author",
      login: "robin",
    })
    expect(ballHolder(pull, NOW)).toEqual({
      kind: "reviewers",
      reviewers: ["lead", "team:leads"],
    })
  })
})
