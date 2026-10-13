export const LANGUAGES = ["fr", "en"] as const

export type Language = (typeof LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = "fr"

/** Each language in its own words, for the picker. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: "Français",
  en: "English",
}

/** The name the AI prompts use: « Write in French ». */
export const LANGUAGE_PROMPT_NAMES: Record<Language, string> = {
  fr: "French",
  en: "English",
}

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language)
}

/**
 * One domain of the dictionary. The French messages set the shape, and the
 * English ones must match it: a missing or extra key fails the typecheck.
 * Messages are strings, or functions when they take values.
 */
export function defineMessages<T extends Record<string, unknown>>(messages: {
  fr: T
  en: NoInfer<T>
}): Record<Language, T> {
  return messages
}
