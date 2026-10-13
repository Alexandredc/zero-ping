/** The `@word` being typed right before the caret, or null when there is none. */
export function mentionQueryAt(
  value: string,
  caret: number
): { start: number; query: string } | null {
  const match = /(^|[\s(])@([\w-]*)$/.exec(value.slice(0, caret))
  if (!match) return null
  return { start: caret - match[2].length - 1, query: match[2] }
}

/** Replaces the `@word` at `start` with the login and a space, and says where the caret goes. */
export function insertMention(
  value: string,
  start: number,
  caret: number,
  login: string
): { value: string; caret: number } {
  // A space already after the caret is reused rather than doubled.
  const rest = value.slice(caret)
  const mention = rest.startsWith(" ") ? `@${login}` : `@${login} `
  return {
    value: value.slice(0, start) + mention + rest,
    caret: start + mention.length + (rest.startsWith(" ") ? 1 : 0),
  }
}

/** People whose login or name starts with the query first, then those containing it. */
export function rankMentions<T extends { login: string; name: string | null }>(
  people: T[],
  query: string,
  limit = 6
): T[] {
  const q = query.toLowerCase()
  const score = (person: T) => {
    const login = person.login.toLowerCase()
    const name = (person.name ?? "").toLowerCase()
    if (login.startsWith(q)) return 0
    if (name.split(/\s+/).some((part) => part.startsWith(q))) return 1
    if (login.includes(q) || name.includes(q)) return 2
    return -1
  }
  return people
    .map((person) => ({ person, rank: score(person) }))
    .filter(({ rank }) => rank >= 0)
    .sort(
      (a, b) => a.rank - b.rank || a.person.login.localeCompare(b.person.login)
    )
    .slice(0, limit)
    .map(({ person }) => person)
}
