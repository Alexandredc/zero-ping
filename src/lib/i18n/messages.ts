import { LANGUAGES } from "./core"
import type { Language } from "./core"
import { common } from "./messages/common"
import { nav } from "./messages/nav"
import { settings } from "./messages/settings"
import { inbox } from "./messages/inbox"
import { detail } from "./messages/detail"
import { pull } from "./messages/pull"
import { dashboard } from "./messages/dashboard"
import { team } from "./messages/team"
import { recap } from "./messages/recap"
import { issues } from "./messages/issues"
import { server } from "./messages/server"

const domains = {
  common,
  nav,
  settings,
  inbox,
  detail,
  pull,
  dashboard,
  team,
  recap,
  issues,
  server,
}

type Domains = typeof domains

/** The whole dictionary of one language, one key per domain: `t.inbox.…`. */
export type Messages = { [Domain in keyof Domains]: Domains[Domain]["fr"] }

const dictionaries = Object.fromEntries(
  LANGUAGES.map((language) => [
    language,
    Object.fromEntries(
      Object.entries(domains).map(([name, domain]) => [name, domain[language]])
    ),
  ])
) as Record<Language, Messages>

export function messagesFor(language: Language): Messages {
  return dictionaries[language]
}
