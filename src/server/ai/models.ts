import "@/server/env"
import { anthropic } from "@ai-sdk/anthropic"
import { typeSafeAi } from "@ai-sdk/typesafe-ai"
import type { Experimental_DecisionModel } from "ai"
import { isDemo } from "@/server/demo/mode"

/**
 * Decision model used for prioritisation. Jev is the default; AI_DECISION_MODEL
 * switches provider (`typesafe:<id>` or `anthropic:<id>`). Returns null when no
 * matching API key is configured, in which case only deterministic rules apply.
 */
export function getDecisionModel(): Experimental_DecisionModel | null {
  // The demo shows stored KPIs and never asks Jev.
  if (isDemo()) return null
  const [provider, ...rest] = (
    process.env.AI_DECISION_MODEL ?? "typesafe:jev-latest"
  ).split(":")
  const modelId = rest.join(":")
  if (provider === "typesafe" && process.env.TYPESAFE_AI_API_KEY) {
    return typeSafeAi.decisionModel(modelId)
  }
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return anthropic.decisionModel(modelId)
  }
  return null
}
