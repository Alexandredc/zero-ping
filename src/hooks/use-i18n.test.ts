import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { languageQuery, useI18n } from "./use-i18n"
import type { Language } from "@/lib/i18n/core"

vi.mock("@/functions/inbox", () => ({ getLanguageSetting: vi.fn() }))

function Probe() {
  const { language, t } = useI18n()
  return createElement("p", { lang: language }, t.common.cancel)
}

/** Renders like the server does: from what the root route loaded, without fetching. */
function render(language?: Language) {
  const queryClient = new QueryClient()
  if (language) queryClient.setQueryData(languageQuery().queryKey, language)
  return renderToString(
    createElement(QueryClientProvider, { client: queryClient }, [
      createElement(Probe, { key: "probe" }),
    ])
  )
}

describe("useI18n", () => {
  it("renders the language loaded before the first paint", () => {
    expect(render("en")).toBe('<p lang="en">Cancel</p>')
    expect(render("fr")).toBe('<p lang="fr">Annuler</p>')
  })

  it("falls back to French before the language is known", () => {
    expect(render()).toBe('<p lang="fr">Annuler</p>')
  })
})
