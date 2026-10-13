import { describe, expect, it } from "vitest"
import { LANGUAGES, isLanguage } from "./core"
import { messagesFor } from "./messages"

/** Every key path of a dictionary, with the kind of value it holds. */
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}()${value.length}`]
  if (typeof value === "string") return [path]
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => shape(child, path ? `${path}.${key}` : key)
  )
}

/** Every plain string a dictionary holds; functions are covered by their arity. */
function strings(value: unknown): string[] {
  if (typeof value === "function") return []
  if (typeof value === "string") return [value]
  return Object.values(value as Record<string, unknown>).flatMap(strings)
}

describe("dictionary", () => {
  it("has the same keys and arities in every language", () => {
    const [first, ...others] = LANGUAGES.map((language) =>
      shape(messagesFor(language)).sort()
    )
    for (const other of others) expect(other).toEqual(first)
  })

  it("has no empty message", () => {
    for (const language of LANGUAGES) {
      for (const message of strings(messagesFor(language)))
        expect(message.trim()).not.toBe("")
    }
  })

  it("translates the shared messages", () => {
    expect(messagesFor("fr").common.cancel).toBe("Annuler")
    expect(messagesFor("en").common.cancel).toBe("Cancel")
    expect(messagesFor("en").nav.folders.review.label).toBe("To review")
  })

  it("recognises the supported languages", () => {
    expect(isLanguage("fr")).toBe(true)
    expect(isLanguage("en")).toBe(true)
    expect(isLanguage("de")).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})
