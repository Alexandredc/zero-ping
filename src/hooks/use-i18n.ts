import { queryOptions, useQuery } from "@tanstack/react-query"
import { getLanguageSetting } from "@/functions/inbox"
import { DEFAULT_LANGUAGE } from "@/lib/i18n/core"
import type { Language } from "@/lib/i18n/core"
import { messagesFor } from "@/lib/i18n/messages"
import type { Messages } from "@/lib/i18n/messages"

/**
 * Loaded by the root route before the first render, so the server renders the
 * page in the chosen language and the client hydrates it without a flash.
 */
export const languageQuery = () =>
  queryOptions({
    queryKey: ["language"],
    queryFn: () => getLanguageSetting(),
    staleTime: Infinity,
  })

export function useLanguage(): Language {
  return useQuery(languageQuery()).data ?? DEFAULT_LANGUAGE
}

/** The dictionary of the chosen language: `const { t } = useI18n()`. */
export function useI18n(): { language: Language; t: Messages } {
  const language = useLanguage()
  return { language, t: messagesFor(language) }
}
