import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { RefreshCwIcon, SparklesIcon } from "lucide-react"
import { Hint } from "./hint"
import { Markdown } from "./markdown"
import type { SummaryLength } from "@/server/db/schema"
import { summaryQuery, useSummarize } from "@/hooks/use-inbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { timeAgo } from "@/lib/format"

export const LENGTH_LABEL: Record<SummaryLength, string> = {
  short: "Court",
  standard: "Standard",
  detailed: "Détaillé",
}

const LENGTH_HINT: Record<SummaryLength, string> = {
  short: "L'essentiel en une phrase, lisible en 15 secondes",
  standard: "Les points clés, lisible en moins d'une minute",
  detailed: "Toutes les décisions, désaccords et points en suspens",
}

const LENGTH_DURATION: Record<SummaryLength, string> = {
  short: "10 à 20 s",
  standard: "15 à 40 s",
  detailed: "20 à 60 s",
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm">
        {items.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  )
}

function LengthPicker({
  value,
  onChange,
  ready,
}: {
  value: SummaryLength
  onChange: (length: SummaryLength) => void
  ready: Record<SummaryLength, boolean>
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => next[0] && onChange(next[0] as SummaryLength)}
      variant="outline"
      size="sm"
      aria-label="Longueur du résumé"
    >
      {(Object.keys(LENGTH_LABEL) as SummaryLength[]).map((length) => (
        <Hint
          key={length}
          content={`${LENGTH_HINT[length]}${ready[length] ? " · déjà généré" : ""}`}
        >
          <ToggleGroupItem value={length}>
            {LENGTH_LABEL[length]}
            {ready[length] && (
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-label="déjà généré"
              />
            )}
          </ToggleGroupItem>
        </Hint>
      ))}
    </ToggleGroup>
  )
}

export function SummaryCard({
  itemKey,
  kind,
}: {
  itemKey: string
  kind: "PR" | "issue"
}) {
  const { data, isPending } = useQuery(summaryQuery(itemKey))
  const summarize = useSummarize(itemKey)
  const [chosen, setChosen] = useState<SummaryLength | null>(null)

  if (isPending || !data) return <Skeleton className="h-10 w-full" />

  const length = chosen ?? data.defaultLength
  const summary = data.summaries[length]
  const generating =
    data.generating.includes(length) ||
    (summarize.isPending && summarize.variables === length)
  const ready = {
    short: data.summaries.short !== null,
    standard: data.summaries.standard !== null,
    detailed: data.summaries.detailed !== null,
  }
  const hasAny = ready.short || ready.standard || ready.detailed

  if (!hasAny && !generating) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-3 py-2">
        <SparklesIcon className="size-4 text-primary" />
        <p className="min-w-48 flex-1 text-sm text-muted-foreground">
          Pas le temps de tout lire ? Claude résume la {kind}, ses fils Slack et
          ce qu'on attend de toi.
        </p>
        <LengthPicker value={length} onChange={setChosen} ready={ready} />
        <Button size="sm" onClick={() => summarize.mutate(length)}>
          Résumer avec Claude
        </Button>
      </div>
    )
  }

  return (
    <section
      aria-label="Résumé IA"
      className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-accent/40 p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <SparklesIcon className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Résumé IA</h3>
        <LengthPicker value={length} onChange={setChosen} ready={ready} />
        {summary && !generating && (
          <span className="text-xs text-muted-foreground">
            {timeAgo(summary.createdAt)} · {summary.model}
          </span>
        )}
        {summary?.outdated && !generating && (
          <Hint content="Il y a eu de l'activité sur GitHub depuis ce résumé : régénère-le pour en tenir compte.">
            <Badge
              variant="outline"
              className="cursor-help border-heat/40 text-heat-foreground"
            >
              Pas à jour
            </Badge>
          </Hint>
        )}
        {summary && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => summarize.mutate(length)}
            disabled={generating}
          >
            {generating ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {generating
              ? `Claude résume… (${LENGTH_DURATION[length]})`
              : "Régénérer"}
          </Button>
        )}
      </header>

      {!summary && !generating && (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-muted-foreground">
            Pas encore de résumé {LENGTH_LABEL[length].toLowerCase()} pour cette{" "}
            {kind}.
          </p>
          <Button size="sm" onClick={() => summarize.mutate(length)}>
            Générer ({LENGTH_DURATION[length]})
          </Button>
        </div>
      )}

      {generating && !summary && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Claude lit la conversation… ({LENGTH_DURATION[length]})
          </p>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {summary && (
        <div
          className={
            generating
              ? "flex flex-col gap-3 opacity-50"
              : "flex flex-col gap-3"
          }
        >
          <div className="font-medium">
            <Markdown>{summary.content.tldr}</Markdown>
          </div>
          {summary.content.expectedFromMe && (
            <div className="rounded-md border border-heat/30 bg-background px-3 py-2">
              <h4 className="text-xs font-medium text-heat-foreground">
                Ce qu'on attend de toi
              </h4>
              <Markdown>{summary.content.expectedFromMe}</Markdown>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-medium text-muted-foreground">
              Où on en est
            </h4>
            <Markdown>{summary.content.status}</Markdown>
          </div>
          <List
            title="Questions ouvertes"
            items={summary.content.openQuestions}
          />
          <List title="Points de vigilance" items={summary.content.risks} />
        </div>
      )}
    </section>
  )
}
