import { createHash } from "node:crypto"
import { experimental_decide } from "ai"
import type { Experimental_DecisionModel } from "ai"
import type { Awaiting, SubjectDetails } from "@/server/inbox/analyze"
import { URGENCY_LEVELS } from "@/server/inbox/priority"

export type Triage = {
  urgency: number
  confidence: number | null
  questionProbability: number | null
}

export type TriageInput = {
  details: SubjectDetails
  awaiting: Awaiting | null
  viewerLogin: string
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** Compact state sent to the model: no diff, only what a lead reads first. */
export function buildTriageState({
  details,
  awaiting,
  viewerLogin,
}: TriageInput) {
  return {
    reader: viewerLogin,
    kind: details.kind,
    title: details.title,
    description: truncate(details.body, 2000),
    labels: details.labels,
    author: details.author,
    isDraft: details.isDraft,
    linesChanged:
      details.additions === null
        ? null
        : details.additions + (details.deletions ?? 0),
    ci: details.ciState,
    latestComments: details.comments.slice(-3).map((comment) => ({
      author: comment.author,
      body: truncate(comment.body, 600),
    })),
    messageForReader: awaiting
      ? { author: awaiting.from, body: awaiting.excerpt }
      : null,
  }
}

/** Changes whenever the inputs of the triage change, to avoid re-asking the model. */
export function triageHash(input: TriageInput): string {
  return createHash("sha256")
    .update(JSON.stringify(buildTriageState(input)))
    .digest("hex")
}

export async function triage(
  model: Experimental_DecisionModel,
  input: TriageInput
): Promise<Triage> {
  const urgency = {
    type: "score",
    instructions:
      "How urgently should the reader, a lead developer, act on this item? Consider production impact, blocked teammates and explicit deadlines.",
    criteria: [...URGENCY_LEVELS],
  } as const

  if (!input.awaiting) {
    const result = await experimental_decide({
      model,
      state: buildTriageState(input),
      questions: { urgency },
    })
    return {
      urgency: result.answers.urgency.score,
      confidence: confidenceOf(result.providerMetadata, "urgency"),
      questionProbability: null,
    }
  }

  const result = await experimental_decide({
    model,
    state: buildTriageState(input),
    questions: {
      urgency,
      question: {
        type: "boolean",
        instructions:
          "Does messageForReader ask the reader a question or request a decision that only they can answer?",
      },
    },
  })
  return {
    urgency: result.answers.urgency.score,
    confidence: confidenceOf(result.providerMetadata, "urgency"),
    questionProbability: result.answers.question.probability,
  }
}

export function confidenceOf(
  metadata: unknown,
  questionId: string
): number | null {
  const confidence = (
    metadata as
      { typesafe?: { confidence?: Record<string, number> } } | undefined
  )?.typesafe?.confidence?.[questionId]
  return typeof confidence === "number" ? confidence : null
}
