import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { ChevronRightIcon, RefreshCwIcon, SparklesIcon } from "lucide-react"
import { ActionHint, Hint } from "./hint"
import { AskAi } from "./ask-ai"
import { Markdown } from "./markdown"
import type { SummaryLength } from "@/server/db/schema"
import {
  summaryQuery,
  summaryReadQuery,
  useSummarize,
  useSummaryRead,
} from "@/hooks/use-inbox"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { timeAgo } from "@/lib/format"
import { useI18n } from "@/hooks/use-i18n"

const LENGTHS: SummaryLength[] = ["short", "standard", "detailed"]

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
  const { t } = useI18n()
  const copy = t.detail.summary
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => next[0] && onChange(next[0] as SummaryLength)}
      variant="outline"
      size="sm"
      aria-label={copy.lengthPicker}
      className="bg-background"
    >
      {LENGTHS.map((length) => (
        // ActionHint renders the item itself, so the group keeps its own children.
        <ActionHint
          key={length}
          side="top"
          content={`${copy.lengthHints[length]}${ready[length] ? ` · ${copy.alreadyGenerated}` : ""}`}
        >
          <ToggleGroupItem
            value={length}
            className="aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
          >
            {copy.lengths[length]}
            {ready[length] && (
              <span
                className="size-1.5 rounded-full bg-current opacity-70"
                aria-label={copy.alreadyGenerated}
              />
            )}
          </ToggleGroupItem>
        </ActionHint>
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
  const { t, language } = useI18n()
  const copy = t.detail.summary
  const { data, isPending } = useQuery(summaryQuery(itemKey))
  const { data: readState } = useQuery(summaryReadQuery(itemKey))
  const summarize = useSummarize(itemKey)
  const markRead = useSummaryRead(itemKey)
  const [chosen, setChosen] = useState<SummaryLength | null>(null)
  // Null until the viewer folds or unfolds it: a read summary starts folded.
  const [openChoice, setOpenChoice] = useState<boolean | null>(null)

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
  // A summary regenerated after it was read is new again.
  const isRead = Boolean(
    readState?.readAt &&
    summary &&
    new Date(readState.readAt) >= new Date(summary.createdAt)
  )
  const open = openChoice ?? !isRead

  if (!hasAny && !generating) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-dashed px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <SparklesIcon className="size-4 text-primary" />
          <p className="min-w-48 flex-1 text-sm text-muted-foreground">
            {copy.pitch(kind)}
          </p>
          <LengthPicker value={length} onChange={setChosen} ready={ready} />
          <Button size="sm" onClick={() => summarize.mutate(length)}>
            {copy.summarize}
          </Button>
        </div>
        <AskAi itemKey={itemKey} kind={kind} />
      </section>
    )
  }

  return (
    <section
      aria-label={copy.title}
      className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-accent/40 p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenChoice(!open)}
          className="flex items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
          <SparklesIcon className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{copy.title}</h3>
        </button>
        <LengthPicker value={length} onChange={setChosen} ready={ready} />
        {summary && !generating && (
          <span className="text-xs text-muted-foreground">
            {timeAgo(summary.createdAt, language)} · {summary.model}
          </span>
        )}
        {summary?.outdated && !generating && (
          <Hint content={copy.outdatedHint}>
            <Badge
              variant="outline"
              className="cursor-help border-heat/40 text-heat-foreground"
            >
              {copy.outdated}
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
              ? copy.generating(copy.lengthDurations[length])
              : copy.regenerate}
          </Button>
        )}
        {summary && (
          <Hint content={copy.readHint}>
            <label className="flex cursor-pointer items-center gap-1.5 rounded border bg-background px-1.5 py-0.5 text-xs">
              <Checkbox
                checked={isRead}
                onCheckedChange={(checked) => {
                  markRead.mutate(checked)
                  setOpenChoice(!checked)
                }}
              />
              {copy.read}
            </label>
          </Hint>
        )}
      </header>
      {open && (
        <>
          {!summary && !generating && (
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm text-muted-foreground">
                {copy.missing(copy.lengths[length], kind)}
              </p>
              <Button size="sm" onClick={() => summarize.mutate(length)}>
                {copy.generate(copy.lengthDurations[length])}
              </Button>
            </div>
          )}

          {generating && !summary && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {copy.reading(copy.lengthDurations[length])}
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
                    {copy.expectedFromMe}
                  </h4>
                  <Markdown>{summary.content.expectedFromMe}</Markdown>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {copy.status}
                </h4>
                <Markdown>{summary.content.status}</Markdown>
              </div>
              <List
                title={copy.openQuestions}
                items={summary.content.openQuestions}
              />
              <List title={copy.risks} items={summary.content.risks} />
            </div>
          )}
          <AskAi itemKey={itemKey} kind={kind} />
        </>
      )}
    </section>
  )
}
