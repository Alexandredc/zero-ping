import { useMutation } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { SearchIcon, SparklesIcon, XIcon } from "lucide-react"
import { ActionHint } from "@/components/inbox/hint"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { postSearch } from "@/functions/inbox"
import type { SearchCandidate, SearchMatch } from "@/server/search/smart-search"

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

/**
 * Typing filters the list at once on titles, numbers, people and labels;
 * Entrée hands the search to Claude, who reads the descriptions too.
 */
export function useSmartSearch<T>({
  kind,
  items,
  toCandidate,
  resetKey,
}: {
  kind: "PR" | "issue"
  items: T[]
  toCandidate: (item: T) => SearchCandidate
  resetKey: string
}) {
  const [text, setText] = useState("")
  const [result, setResult] = useState<{
    query: string
    matches: SearchMatch[]
  } | null>(null)
  const search = useMutation({
    mutationFn: (query: string) =>
      postSearch({
        data: { kind, query, candidates: items.map(toCandidate) },
      }).then((matches) => ({ query, matches })),
    onSuccess: setResult,
    onError: (error) =>
      toast.add({
        title: "Recherche IA impossible",
        description: error.message,
        type: "error",
      }),
  })

  useEffect(() => {
    setText("")
    setResult(null)
  }, [resetKey])

  const query = text.trim()
  const ai = result && result.query === query ? result : null
  const visible = useMemo(() => {
    if (ai) {
      const byKey = new Map(items.map((item) => [toCandidate(item).key, item]))
      return ai.matches.flatMap((match) => {
        const item = byKey.get(match.key)
        return item ? [item] : []
      })
    }
    if (!query) return items
    const words = fold(query).split(/\s+/)
    return items.filter((item) => {
      const c = toCandidate(item)
      const haystack = fold(
        [c.key, c.title, c.author ?? "", ...c.labels, ...c.facts].join(" ")
      )
      return words.every((word) => haystack.includes(word))
    })
    // toCandidate is a pure mapping the caller redefines on each render.
  }, [ai, items, query])

  return {
    text,
    setText,
    query,
    ai,
    visible,
    total: items.length,
    pending: search.isPending,
    ask: () => {
      if (query && !search.isPending) search.mutate(query)
    },
    clear: () => {
      setText("")
      setResult(null)
    },
    reasonOf: (key: string) =>
      ai?.matches.find((match) => match.key === key)?.reason ?? null,
  }
}

export function SmartSearchBar({
  search,
  noun,
}: {
  search: ReturnType<typeof useSmartSearch<unknown>>
  /** Plural noun of the items, as in « 3 PR » or « 3 issues ». */
  noun: string
}) {
  return (
    <div className="flex flex-col gap-1 border-b px-3 py-2">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          search.ask()
        }}
      >
        <InputGroup>
          <InputGroupAddon>
            {search.pending ? <Spinner /> : <SearchIcon />}
          </InputGroupAddon>
          <InputGroupInput
            value={search.text}
            onChange={(event) => search.setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search.text) {
                event.preventDefault()
                event.stopPropagation()
                search.clear()
              }
            }}
            placeholder={`Chercher ou décrire ${noun === "PR" ? "une PR" : "une issue"}…`}
            aria-label={`Chercher des ${noun}`}
          />
          <InputGroupAddon align="inline-end">
            {search.text && (
              <InputGroupButton
                size="icon-xs"
                onClick={search.clear}
                aria-label="Effacer la recherche"
              >
                <XIcon />
              </InputGroupButton>
            )}
            <ActionHint content="L'IA lit les titres, descriptions, labels et résumés de la liste pour trouver ce que tu décris (Entrée).">
              <InputGroupButton
                type="submit"
                variant={search.ai ? "secondary" : "ghost"}
                disabled={!search.query || search.pending}
              >
                <SparklesIcon />
                Recherche IA
              </InputGroupButton>
            </ActionHint>
          </InputGroupAddon>
        </InputGroup>
      </form>
      {search.query && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {search.pending ? (
            "Recherche IA en cours…"
          ) : search.ai ? (
            search.visible.length > 0 ? (
              <>
                <SparklesIcon className="size-3" />
                {search.visible.length} {noun} trouvée
                {search.visible.length > 1 ? "s" : ""} par la recherche IA
              </>
            ) : (
              `Aucune ${noun} ne correspond, selon la recherche IA.`
            )
          ) : (
            <>
              {search.visible.length} sur {search.total} par le texte ·{" "}
              <Kbd>Entrée</Kbd> pour la recherche IA
            </>
          )}
        </p>
      )}
    </div>
  )
}

/** Why Claude picked the item, under its row in the list. */
export function MatchReason({ reason }: { reason: string | null }) {
  if (!reason) return null
  return (
    <p className="flex items-start gap-1.5 border-b bg-accent/30 px-4 py-1.5 text-xs text-muted-foreground">
      <SparklesIcon className="mt-0.5 size-3 shrink-0" />
      {reason}
    </p>
  )
}
