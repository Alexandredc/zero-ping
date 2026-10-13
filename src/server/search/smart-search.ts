import type { Octokit } from "octokit"
import { z } from "zod"
import { LANGUAGE_PROMPT_NAMES } from "@/lib/i18n/core"
import type { Language } from "@/lib/i18n/core"

/** What the list already knows of an item, sent along with the question. */
export type SearchCandidate = {
  key: string
  title: string
  author: string | null
  labels: string[]
  /** Short facts the list shows: draft, board column, sprint, assignees… */
  facts: string[]
}

export type SearchMatch = { key: string; reason: string }

export const MAX_CANDIDATES = 200
const MAX_BODY_CHARS = 600

export function searchJsonSchema(language: Language) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["matches"],
    properties: {
      matches: {
        type: "array",
        description: "The items that answer the search, the best match first.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "reason"],
          properties: {
            key: { type: "string", description: "The item's key, as given." },
            reason: {
              type: "string",
              description: `Why it matches, in a few ${LANGUAGE_PROMPT_NAMES[language]} words.`,
            },
          },
        },
      },
    },
  }
}

export function buildSearchPrompt(
  kind: "PR" | "issue",
  language: Language
): string {
  const things = kind === "PR" ? "pull requests" : "issues"
  const words = LANGUAGE_PROMPT_NAMES[language]
  return [
    `Find the ${things} that answer the user's search, among the list given on stdin.`,
    "The search may be in French or English, and the items in either: match on meaning across both languages and on domain synonyms (réclamation = claim, transporteur = carrier, commande = order, entrepôt = warehouse…), not on shared words.",
    "It may describe the work, a part of the code, a person (by name or handle), a state or a moment rather than quote a title.",
    `Read each item's title, branch, description, labels, facts and summary. Return every ${things.slice(0, -1)} that is about what is searched, the best match first, at most 10. Leave out items that only brush the subject, and return none when nothing is about it.`,
    `Give each match a reason of a few ${words} words that tells what in the item answers the search.`,
    "Only use what the input says. Do not use any tool.",
  ].join("\n")
}

export function buildSearchInput(
  query: string,
  candidates: (SearchCandidate & {
    body: string | null
    summary: string | null
  })[]
): string {
  const lines = [`## Search\n${query}`, "", "## Items"]
  for (const item of candidates) {
    lines.push(
      "",
      `### ${item.key} — ${item.title}`,
      [
        item.author && `author: ${item.author}`,
        item.labels.length > 0 && `labels: ${item.labels.join(", ")}`,
        ...item.facts,
      ]
        .filter(Boolean)
        .join(" · ")
    )
    if (item.summary) lines.push(`Summary: ${item.summary}`)
    if (item.body) lines.push(item.body)
  }
  return lines.join("\n")
}

/** The matches, kept to the items that were asked about and in the AI's order. */
export function parseSearchAnswer(
  answer: unknown,
  keys: Set<string>
): SearchMatch[] {
  const { matches } = z
    .object({
      matches: z.array(z.object({ key: z.string(), reason: z.string() })),
    })
    .parse(answer)
  const seen = new Set<string>()
  return matches.filter((match) => {
    if (!keys.has(match.key) || seen.has(match.key)) return false
    seen.add(match.key)
    return true
  })
}

function clip(text: string, max: number) {
  const flat = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** The descriptions of the items, read from GitHub in one query. */
export async function fetchBodies(
  octokit: Octokit,
  keys: string[]
): Promise<Map<string, string>> {
  const refs = keys.flatMap((key) => {
    const match = /^([^/]+)\/([^#]+)#(\d+)$/.exec(key)
    return match
      ? [{ key, owner: match[1], name: match[2], number: match[3] }]
      : []
  })
  if (refs.length === 0) return new Map()
  const query = `query {${refs
    .map(
      (ref, index) =>
        `i${index}: repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.name)}) {
          issueOrPullRequest(number: ${ref.number}) {
            ... on Issue { body }
            ... on PullRequest { body headRefName }
          }
        }`
    )
    .join("\n")}}`
  const data = await octokit.graphql<
    Record<
      string,
      {
        issueOrPullRequest: { body?: string; headRefName?: string } | null
      } | null
    >
  >(query)
  const bodies = new Map<string, string>()
  refs.forEach((ref, index) => {
    const subject = data[`i${index}`]?.issueOrPullRequest
    if (!subject) return
    const branch = subject.headRefName ? `branch: ${subject.headRefName}. ` : ""
    bodies.set(ref.key, branch + clip(subject.body ?? "", MAX_BODY_CHARS))
  })
  return bodies
}
