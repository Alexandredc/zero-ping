import { describe, expect, it } from "vitest"
import { describeUat } from "./uat-badge"
import { messagesFor } from "@/lib/i18n/messages"

const partial = {
  state: "partial" as const,
  shipped: 1,
  total: 3,
  at: null,
  outdated: [],
  missing: ["fix: login", "feat: export"],
}

describe("describeUat", () => {
  it("keeps the French copy", () => {
    expect(describeUat(partial, messagesFor("fr"), "fr")).toEqual({
      label: "En partie sur UAT · 1/3",
      detail: [
        "Dernier déploiement.",
        "Pas encore sur uat :",
        "• fix: login",
        "• feat: export",
      ],
    })
  })

  it("speaks English", () => {
    expect(describeUat(partial, messagesFor("en"), "en")).toEqual({
      label: "Partly on UAT · 1/3",
      detail: [
        "Last deploy.",
        "Not on uat yet:",
        "• fix: login",
        "• feat: export",
      ],
    })
  })

  it("flags a deployed PR whose commits were rewritten", () => {
    const status = {
      ...partial,
      state: "deployed" as const,
      missing: [],
      outdated: ["fix: login"],
    }
    expect(describeUat(status, messagesFor("fr"), "fr").label).toBe(
      "Sur UAT, à redéployer"
    )
    expect(describeUat(status, messagesFor("en"), "en").label).toBe(
      "On UAT, to redeploy"
    )
  })

  it("names the merge commit when the PR is merged", () => {
    expect(
      describeUat({ state: "merged" }, messagesFor("en"), "en").detail
    ).toEqual(["The merge commit is in the uat history."])
  })
})
