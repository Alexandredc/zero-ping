import { useQuery } from "@tanstack/react-query"
import { GaugeIcon, InfoIcon, RefreshCwIcon } from "lucide-react"
import { Hint } from "./hint"
import type { PullInsight } from "@/server/db/schema"
import {
  concern,
  insightLabel,
  issueInsightSpecs,
  pullInsightSpecs,
} from "@/lib/insights"
import type { InsightSpec } from "@/lib/insights"
import { insightsQuery, useRefreshInsights } from "@/hooks/use-inbox"
import type { SlackSubjectInput } from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import { useI18n } from "@/hooks/use-i18n"
import type { Messages } from "@/lib/i18n/messages"
import { MIN_AI_CONFIDENCE } from "@/server/inbox/priority"

/** The specialist reviews, shown together as one « Expertise » tile. */
const EXPERTISE = ["security", "data", "infra"]

function tone(level: number, unsure: boolean) {
  if (unsure) return "text-muted-foreground"
  if (level >= 0.66) return "text-destructive"
  if (level >= 0.4) return "text-heat-foreground"
  return "text-diff-add-strong"
}

type Kind = "PR" | "issue"

const specsFor = (kind: Kind, t: Messages) =>
  kind === "PR" ? pullInsightSpecs(t) : issueInsightSpecs(t)

/** The tiles as they will appear, so the loading state has the same shape. */
function tileLabels(kind: Kind, t: Messages) {
  const specs = specsFor(kind, t).filter((spec) => !EXPERTISE.includes(spec.id))
  return [
    ...specs.map((spec) => spec.label),
    ...(kind === "PR" ? [t.pull.insights.expertiseRequired] : []),
  ]
}

/** One fixed-height row per line, shared by tiles and their placeholders. */
const TILE_CLASS =
  "flex h-14 min-w-0 flex-col justify-center gap-0.5 rounded-md border bg-background px-2.5"
const CARD_CLASS =
  "flex flex-col gap-3 rounded-lg border border-primary/20 bg-accent/40 p-4"

const formatConfidence = (confidence: number | null, t: Messages) =>
  confidence === null
    ? t.pull.insights.confidenceMissing
    : t.pull.insights.percent(Math.round(confidence * 100))

/**
 * One KPI tile: the label on top, the value below. The loading state uses the
 * same frame with a placeholder value, so nothing moves when Jev answers.
 */
function TileFrame({
  label,
  hint,
  children,
}: {
  label: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1 text-[0.7rem] text-muted-foreground">
        <span className="truncate">{label}</span>
        <InfoIcon className="size-3 shrink-0 opacity-60" />
      </span>
      <span className="flex h-5 items-center gap-1.5">{children}</span>
    </>
  )
  if (!hint) return <div className={TILE_CLASS}>{content}</div>
  return (
    <Hint instant content={hint} className={cn(TILE_CLASS, "cursor-help")}>
      {content}
    </Hint>
  )
}

function Tile({
  label,
  value,
  level,
  unsure,
  hint,
}: {
  label: string
  value: string
  level: number
  unsure: boolean
  hint: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <TileFrame label={label} hint={hint}>
      <span
        className={cn("truncate text-sm font-semibold", tone(level, unsure))}
      >
        {value}
      </span>
      {unsure && (
        <span className="rounded border border-dashed px-1 text-[0.6rem] text-muted-foreground">
          {t.pull.insights.unsure}
        </span>
      )}
    </TileFrame>
  )
}

/** What Jev answered, on the KPI's own scale, for the tile's hover. */
function Scale({ spec, insight }: { spec: InsightSpec; insight: PullInsight }) {
  const { t } = useI18n()
  if (spec.kind === "yesno")
    return (
      <span>
        {t.pull.insights.yesProbability(spec.yes.toLowerCase())}{" "}
        <span className="font-mono">
          {t.pull.insights.percent(Math.round(insight.value * 100))}
        </span>{" "}
        <span className="opacity-70">{t.pull.insights.yesFrom(spec.yes)}</span>
      </span>
    )
  return (
    <span className="flex flex-col gap-0.5">
      {spec.levels.map((level, index) => (
        <span
          key={level}
          className={cn(
            "flex gap-1.5",
            index === Math.min(insight.level, spec.levels.length - 1)
              ? "font-semibold"
              : "opacity-60"
          )}
        >
          <span className="w-3 shrink-0">
            {index === Math.min(insight.level, spec.levels.length - 1)
              ? "›"
              : ""}
          </span>
          <span>
            {t.pull.insights.levelMeaning(level, spec.meanings[index])}
          </span>
        </span>
      ))}
    </span>
  )
}

function SpecTile({
  spec,
  insight,
}: {
  spec: InsightSpec
  insight: PullInsight
}) {
  const { t } = useI18n()
  const unsure = (insight.confidence ?? 1) < MIN_AI_CONFIDENCE
  return (
    <Tile
      label={spec.label}
      value={insightLabel(spec, insight)}
      level={concern(spec, insight)}
      unsure={unsure}
      hint={
        <span className="flex max-w-80 flex-col gap-1.5">
          <span className="font-medium">{spec.label}</span>
          <span>{spec.hint}</span>
          <Scale spec={spec} insight={insight} />
          <span className="opacity-70">
            {t.pull.insights.confidence(
              formatConfidence(insight.confidence, t)
            )}
            {unsure ? t.pull.insights.unsureNote : t.pull.insights.sureNote}
          </span>
        </span>
      }
    />
  )
}

function Header({
  kind,
  createdAt,
  onRefresh,
  refreshing,
}: {
  kind: Kind
  createdAt: Date | null
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { t, language } = useI18n()
  const m = t.pull.insights
  const noun = kind === "PR" ? m.thePr : m.theIssue
  return (
    <header className="flex h-6 items-center gap-2">
      <GaugeIcon className="size-4 text-primary" />
      <h3 className="text-sm font-semibold">{m.title}</h3>
      <span className="text-xs text-muted-foreground">
        {createdAt ? timeAgo(createdAt, language) : m.evaluating(noun)}
      </span>
      <Hint
        instant
        content={
          <span className="flex max-w-80 flex-col gap-1">
            <span className="font-medium">{m.howToRead}</span>
            <span>
              {kind === "PR" ? m.sourcesPr : m.sourcesIssue} {m.hoverTile}
            </span>
            <span>
              <span className="text-diff-add-strong">{m.legend.green}</span>
              {m.legend.fine}
              <span className="text-heat-foreground">{m.legend.orange}</span>
              {m.legend.watch}
              <span className="text-destructive">{m.legend.red}</span>
              {m.legend.look}
            </span>
            <span>{m.unsureLegend}</span>
            <span className="opacity-70">{m.cacheNote}</span>
          </span>
        }
        className="flex cursor-help text-muted-foreground"
      >
        <InfoIcon className="size-3.5" />
      </Hint>
      {onRefresh && (
        <Hint content={m.refreshHint(noun)} className="ml-auto flex">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={m.refreshLabel}
          >
            {refreshing ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </Hint>
      )}
    </header>
  )
}

/** Jev's KPIs on top of a PR or an issue: risk, effort, readiness and the like. */
export function ItemInsights({
  itemKey,
  kind,
  subject,
}: {
  itemKey: string
  kind: Kind
  /** For an issue outside the inbox: what Jev should read. */
  subject?: SlackSubjectInput
}) {
  const { t } = useI18n()
  const { data, isPending, error } = useQuery(insightsQuery(itemKey, subject))
  const refresh = useRefreshInsights(itemKey, subject)

  if (isPending)
    return (
      <section className={CARD_CLASS} aria-busy>
        <Header kind={kind} createdAt={null} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tileLabels(kind, t).map((label) => (
            <TileFrame key={label} label={label}>
              <Skeleton className="h-4 w-16" />
            </TileFrame>
          ))}
        </div>
      </section>
    )
  if (error)
    return (
      <p className="text-xs text-muted-foreground">
        {t.pull.insights.unavailable(error.message)}
      </p>
    )
  if (!data.available) return null

  const byId = new Map(data.insights.map((insight) => [insight.id, insight]))
  const main = specsFor(kind, t).filter(
    (spec) => !EXPERTISE.includes(spec.id) && byId.has(spec.id)
  )
  const experts =
    kind === "PR"
      ? EXPERTISE.map((id) => byId.get(id)).filter(
          (insight): insight is PullInsight => insight !== undefined
        )
      : []
  const required = experts.filter(
    (insight) =>
      insight.level === 1 && (insight.confidence ?? 1) >= MIN_AI_CONFIDENCE
  )

  return (
    <section aria-label={t.pull.insights.title} className={CARD_CLASS}>
      <Header
        kind={kind}
        createdAt={data.createdAt}
        onRefresh={() => refresh.mutate()}
        refreshing={refresh.isPending}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {main.map((spec) => (
          <SpecTile key={spec.id} spec={spec} insight={byId.get(spec.id)!} />
        ))}
        {experts.length > 0 && (
          <Tile
            label={t.pull.insights.expertiseRequired}
            value={
              required.length === 0
                ? t.pull.insights.noExpertise
                : required
                    .map((insight) => t.pull.insights.expertise[insight.id])
                    .join(", ")
            }
            level={required.length === 0 ? 0 : 0.5}
            unsure={false}
            hint={
              <span className="flex max-w-80 flex-col gap-1">
                <span className="font-medium">
                  {t.pull.insights.expertiseRequired}
                </span>
                <span>{t.pull.insights.expertiseHint}</span>
                {experts.map((insight) => (
                  <span key={insight.id} className="font-mono opacity-80">
                    {t.pull.insights.expertiseLine(
                      t.pull.insights.expertise[insight.id],
                      t.pull.insights.percent(Math.round(insight.value * 100)),
                      formatConfidence(insight.confidence, t)
                    )}
                  </span>
                ))}
              </span>
            }
          />
        )}
      </div>
    </section>
  )
}
