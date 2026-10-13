import { getDb } from "@/server/db/client"
import type { Database } from "@/server/db/client"
import { getPreferences } from "@/server/preferences"
import { messagesFor } from "@/lib/i18n/messages"
import type { Language } from "@/lib/i18n/core"
import type { Messages } from "@/lib/i18n/messages"

/** The language chosen in the settings, for the text the server writes. */
export async function getLanguage(db?: Database): Promise<Language> {
  return (await getPreferences(db ?? (await getDb()))).language
}

/** The chosen language and its dictionary, for errors and notifications. */
export async function getMessages(
  db?: Database
): Promise<{ language: Language; t: Messages }> {
  const language = await getLanguage(db)
  return { language, t: messagesFor(language) }
}
