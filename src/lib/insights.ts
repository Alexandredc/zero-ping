import type { PullInsight } from "@/server/db/schema"
import { DEFAULT_LANGUAGE } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"
import type { Messages } from "@/lib/i18n/messages"

/**
 * The KPIs Jev gives a PR. A `levels` KPI is a score over ordered levels; a
 * `yesno` KPI is a probability. `tone` says which end is the worrying one.
 */
export type InsightSpec = {
  id: string
  label: string
  /** Shown on hover: what the KPI says and what Jev looked at. */
  hint: string
  instructions: string
} & (
  | {
      kind: "levels"
      levels: string[]
      /** What each level means, shown on hover. */
      meanings: string[]
      /** The levels as Jev scores them, in English in every language. */
      criteria: string[]
      worst: "high" | "low"
    }
  | { kind: "yesno"; yes: string; no: string; worst: "yes" | "no" }
)

type LevelsText = {
  label: string
  hint: string
  levels: string[]
  meanings: string[]
}

/**
 * Jev scores on these criteria in English whatever the interface language:
 * its answers are numbers, so the cached KPIs serve every language.
 */
function levels(
  text: LevelsText,
  english: LevelsText
): Pick<LevelsText, "levels" | "meanings"> & { criteria: string[] } {
  return {
    levels: text.levels,
    meanings: text.meanings,
    criteria: english.levels,
  }
}

/** The KPIs of a pull request, in the language of `t`. */
export function pullInsightSpecs(t: Messages): InsightSpec[] {
  const k = t.pull.pullKpis
  const en = messagesFor("en").pull.pullKpis
  return [
    {
      id: "risk",
      label: k.risk.label,
      hint: k.risk.hint,
      instructions:
        "How risky is deploying this pull request to production? Consider database migrations, authentication and permissions, payments, infrastructure or configuration changes, shared code, and the size of the change.",
      kind: "levels",
      ...levels(k.risk, en.risk),
      worst: "high",
    },
    {
      id: "effort",
      label: k.effort.label,
      hint: k.effort.hint,
      instructions:
        "How long would a careful review of this diff take an experienced developer of the codebase?",
      kind: "levels",
      ...levels(k.effort, en.effort),
      worst: "high",
    },
    {
      id: "ready",
      ...k.ready,
      instructions:
        "Can this pull request be merged as it is, without another round of changes? Consider CI, approvals, unresolved review threads and unanswered questions.",
      kind: "yesno",
      worst: "no",
    },
    {
      id: "tests",
      label: k.tests.label,
      hint: k.tests.hint,
      instructions:
        "How well do the tests added or changed in this diff cover the behaviour it changes?",
      kind: "levels",
      ...levels(k.tests, en.tests),
      worst: "low",
    },
    {
      id: "breaking",
      ...k.breaking,
      instructions:
        "Does this pull request break a contract other code or teams rely on: a public or internal API, a database schema, environment variables, an event or message format?",
      kind: "yesno",
      worst: "yes",
    },
    {
      id: "clarity",
      label: k.clarity.label,
      hint: k.clarity.hint,
      instructions:
        "How well does the description explain why the change is made, how to test it and what impact to expect?",
      kind: "levels",
      ...levels(k.clarity, en.clarity),
      worst: "low",
    },
    {
      id: "security",
      ...k.security,
      instructions:
        "Should a security specialist review this pull request (authentication, permissions, secrets, personal data, injection)?",
      kind: "yesno",
      worst: "yes",
    },
    {
      id: "data",
      ...k.data,
      instructions:
        "Should a data or database specialist review this pull request (migrations, queries, indexes, data volume)?",
      kind: "yesno",
      worst: "yes",
    },
    {
      id: "infra",
      ...k.infra,
      instructions:
        "Should an infrastructure specialist review this pull request (Terraform, CI/CD, containers, cloud resources, networking)?",
      kind: "yesno",
      worst: "yes",
    },
  ]
}

/** The KPIs of an issue, read from its description and conversation, in the language of `t`. */
export function issueInsightSpecs(t: Messages): InsightSpec[] {
  const k = t.pull.issueKpis
  const en = messagesFor("en").pull.issueKpis
  return [
    {
      id: "ready",
      ...k.ready,
      instructions:
        "Is this issue specified well enough for a developer to start now: context, acceptance criteria, examples or mock-ups, no open question on the scope?",
      kind: "yesno",
      worst: "no",
    },
    {
      id: "size",
      label: k.size.label,
      hint: k.size.hint,
      instructions:
        "How much work would this issue take one developer of the team, from the scope described?",
      kind: "levels",
      ...levels(k.size, en.size),
      worst: "high",
    },
    {
      id: "impact",
      label: k.impact.label,
      hint: k.impact.hint,
      instructions:
        "How strong is the business impact of this issue: who is affected (customers, operations, finance), is production broken, is a process blocked?",
      kind: "levels",
      ...levels(k.impact, en.impact),
      worst: "high",
    },
    {
      id: "blocked",
      ...k.blocked,
      instructions:
        "Is this issue waiting on something before work can go on: a decision, another team, a dependency, an answer from the business?",
      kind: "yesno",
      worst: "yes",
    },
    {
      id: "split",
      ...k.split,
      instructions:
        "Does this issue mix several topics that would be better tracked as separate issues?",
      kind: "yesno",
      worst: "yes",
    },
    {
      id: "techRisk",
      label: k.techRisk.label,
      hint: k.techRisk.hint,
      instructions:
        "How much technical risk does this issue carry: unknowns, sensitive areas such as data, authentication or infrastructure, need for a spike before coding?",
      kind: "levels",
      ...levels(k.techRisk, en.techRisk),
      worst: "high",
    },
    {
      id: "decision",
      ...k.decision,
      instructions:
        "Does the conversation wait for a question or a decision that the reader, the lead developer, must answer?",
      kind: "yesno",
      worst: "yes",
    },
  ]
}

/** The KPIs of a pull request in the default language; prefer `pullInsightSpecs(t)`. */
export const INSIGHTS: InsightSpec[] = pullInsightSpecs(
  messagesFor(DEFAULT_LANGUAGE)
)

/** The KPIs of an issue in the default language; prefer `issueInsightSpecs(t)`. */
export const ISSUE_INSIGHTS: InsightSpec[] = issueInsightSpecs(
  messagesFor(DEFAULT_LANGUAGE)
)

/** How worrying an answer is, from 0 (fine) to 1 (look at it), for its colour. */
export function concern(spec: InsightSpec, insight: PullInsight): number {
  if (spec.kind === "yesno")
    return spec.worst === "yes" ? insight.value : 1 - insight.value
  const top = spec.levels.length - 1
  return spec.worst === "high" ? insight.value / top : 1 - insight.value / top
}

/** The answer in the interface's words. */
export function insightLabel(spec: InsightSpec, insight: PullInsight): string {
  if (spec.kind === "yesno") return insight.level === 1 ? spec.yes : spec.no
  return spec.levels[Math.min(insight.level, spec.levels.length - 1)]
}
