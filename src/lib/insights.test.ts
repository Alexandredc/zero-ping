import { describe, expect, it } from "vitest"
import {
  INSIGHTS,
  ISSUE_INSIGHTS,
  concern,
  insightLabel,
  issueInsightSpecs,
  pullInsightSpecs,
} from "./insights"
import { messagesFor } from "@/lib/i18n/messages"

const spec = (id: string) => INSIGHTS.find((s) => s.id === id)!

describe("insight labels and concern", () => {
  it("reads a level KPI and rates the worrying end", () => {
    const risk = { id: "risk", level: 2, value: 2.1, confidence: 0.8 }
    expect(insightLabel(spec("risk"), risk)).toBe("Élevé")
    expect(concern(spec("risk"), risk)).toBeCloseTo(0.7)
    // For tests, few is what worries.
    const tests = { id: "tests", level: 0, value: 0, confidence: 0.9 }
    expect(insightLabel(spec("tests"), tests)).toBe("Absents")
    expect(concern(spec("tests"), tests)).toBe(1)
  })

  it("reads a yes/no KPI from its probability", () => {
    const ready = { id: "ready", level: 0, value: 0.2, confidence: 0.7 }
    expect(insightLabel(spec("ready"), ready)).toBe("Pas encore")
    expect(concern(spec("ready"), ready)).toBeCloseTo(0.8)
    const breaking = { id: "breaking", level: 1, value: 0.9, confidence: 0.7 }
    expect(insightLabel(spec("breaking"), breaking)).toBe("Oui")
    expect(concern(spec("breaking"), breaking)).toBeCloseTo(0.9)
  })
})

describe("issue KPIs", () => {
  it("reads readiness and size on their own scales", () => {
    const issue = (id: string) => ISSUE_INSIGHTS.find((s) => s.id === id)!
    expect(
      insightLabel(issue("ready"), {
        id: "ready",
        level: 0,
        value: 0.3,
        confidence: 0.8,
      })
    ).toBe("À préciser")
    const size = { id: "size", level: 4, value: 3.8, confidence: 0.6 }
    expect(insightLabel(issue("size"), size)).toBe("> 1 sprint")
    expect(concern(issue("size"), size)).toBeCloseTo(0.95)
    expect(new Set(ISSUE_INSIGHTS.map((s) => s.id)).size).toBe(7)
  })
})

describe("insight specs by language", () => {
  const fr = messagesFor("fr")
  const en = messagesFor("en")

  it("names the KPIs and their answers in the chosen language", () => {
    const risk = { id: "risk", level: 2, value: 2.1, confidence: 0.8 }
    const frRisk = pullInsightSpecs(fr).find((s) => s.id === "risk")!
    const enRisk = pullInsightSpecs(en).find((s) => s.id === "risk")!
    expect(frRisk.label).toBe("Risque en prod")
    expect(enRisk.label).toBe("Production risk")
    expect(insightLabel(frRisk, risk)).toBe("Élevé")
    expect(insightLabel(enRisk, risk)).toBe("High")
    const ready = { id: "ready", level: 0, value: 0.3, confidence: 0.8 }
    const enReady = issueInsightSpecs(en).find((s) => s.id === "ready")!
    expect(insightLabel(enReady, ready)).toBe("Needs detail")
  })

  it("keeps the same KPIs, scales and English criteria in every language", () => {
    for (const build of [pullInsightSpecs, issueInsightSpecs]) {
      const [frSpecs, enSpecs] = [build(fr), build(en)]
      expect(enSpecs.map((s) => s.id)).toEqual(frSpecs.map((s) => s.id))
      enSpecs.forEach((enSpec, index) => {
        const frSpec = frSpecs[index]
        expect(enSpec.kind).toBe(frSpec.kind)
        if (enSpec.kind !== "levels" || frSpec.kind !== "levels") return
        expect(enSpec.levels).toHaveLength(frSpec.levels.length)
        expect(enSpec.meanings).toHaveLength(frSpec.levels.length)
        expect(frSpec.meanings).toHaveLength(frSpec.levels.length)
        // Jev scores on the same English criteria, so cached KPIs fit both.
        expect(frSpec.criteria).toEqual(enSpec.levels)
        expect(enSpec.criteria).toEqual(enSpec.levels)
      })
    }
  })
})
