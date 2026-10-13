import { inArray } from "drizzle-orm"
import type { Database } from "@/server/db/client"
import { aiScores } from "@/server/db/schema"
import type { SubjectDetails } from "@/server/inbox/analyze"
import { MIN_AI_CONFIDENCE } from "@/server/inbox/priority"
import { getDecisionModel } from "./models"
import { triage, triageHash } from "./triage"
import type { TriageInput } from "./triage"

/** What Jev reads of a PR or an issue that is not in the inbox. */
export type ScoreSubject = {
  key: string
  kind: "PullRequest" | "Issue"
  title: string
  url: string
  body: string
  author: string | null
  labels: string[]
  isDraft: boolean
  additions: number | null
  deletions: number | null
  ciState: string | null
  comments: { author: string | null; body: string }[]
}

export type Score = { urgency: number; confidence: number | null }

/** The triage input of a subject, with neutral values for what Jev does not read. */
export function toTriageInput(
  subject: ScoreSubject,
  viewerLogin: string
): TriageInput {
  const details: SubjectDetails = {
    kind: subject.kind,
    title: subject.title,
    url: subject.url,
    body: subject.body,
    createdAt: "",
    state: "OPEN",
    isDraft: subject.isDraft,
    author: subject.author,
    labels: subject.labels,
    additions: subject.additions,
    deletions: subject.deletions,
    changedFiles: null,
    headOid: null,
    reviews: [],
    ciState: subject.ciState,
    reviewDecision: null,
    reviewRequests: [],
    reviewRequestedAt: [],
    approvals: 0,
    comments: subject.comments.map((comment, index) => ({
      id: String(index),
      databaseId: null,
      author: comment.author,
      body: comment.body,
      createdAt: "",
      url: "",
    })),
    reviewThreads: [],
  }
  return { details, awaiting: null, viewerLogin }
}

/** The urgency to rank by, or null when Jev has not answered or was unsure. */
export function trustedUrgency(score: Score | undefined | null): number | null {
  if (!score) return null
  return (score.confidence ?? 1) >= MIN_AI_CONFIDENCE ? score.urgency : null
}

export async function readScores(
  db: Database,
  keys: string[]
): Promise<Map<string, Score>> {
  if (keys.length === 0) return new Map()
  const rows = await db
    .select()
    .from(aiScores)
    .where(inArray(aiScores.key, keys))
  return new Map(
    rows.map((row) => [
      row.key,
      { urgency: row.urgency, confidence: row.confidence },
    ])
  )
}

const CONCURRENCY = 4
const globalForScores = globalThis as unknown as {
  __zeroPingScoring?: Set<string>
}
const inFlight = (globalForScores.__zeroPingScoring ??= new Set())

/**
 * Asks Jev about the subjects that are new or changed since their last score,
 * a few at a time, without holding the caller: the next read ranks them.
 */
export function scoreInBackground(
  db: Database,
  subjects: ScoreSubject[],
  viewerLogin: string
): void {
  const model = getDecisionModel()
  if (!model || subjects.length === 0) return
  void (async () => {
    const rows = await db
      .select({ key: aiScores.key, hash: aiScores.hash })
      .from(aiScores)
      .where(
        inArray(
          aiScores.key,
          subjects.map((subject) => subject.key)
        )
      )
    const known = new Map(rows.map((row) => [row.key, row.hash]))
    const queue = subjects
      .filter((subject) => !inFlight.has(subject.key))
      .map((subject) => {
        const input = toTriageInput(subject, viewerLogin)
        return { subject, input, hash: triageHash(input) }
      })
      .filter(({ subject, hash }) => known.get(subject.key) !== hash)
    queue.forEach(({ subject }) => inFlight.add(subject.key))

    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        try {
          const result = await triage(model, next.input)
          const row = {
            key: next.subject.key,
            hash: next.hash,
            urgency: result.urgency,
            confidence: result.confidence,
            scoredAt: new Date(),
          }
          await db
            .insert(aiScores)
            .values(row)
            .onConflictDoUpdate({ target: aiScores.key, set: row })
        } catch (error) {
          console.error(`[score] ${next.subject.key}`, error)
        } finally {
          inFlight.delete(next.subject.key)
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  })().catch((error: unknown) => console.error("[score]", error))
}
