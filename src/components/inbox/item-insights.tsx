import { useQuery } from "@tanstack/react-query"
import { GaugeIcon, InfoIcon, RefreshCwIcon } from "lucide-react"
import { Hint } from "./hint"
import type { PullInsight } from "@/server/db/schema"
import { INSIGHTS, ISSUE_INSIGHTS, concern, insightLabel } from "@/lib/insights"
import type { InsightSpec } from "@/lib/insights"
import { insightsQuery, useRefreshInsights } from "@/hooks/use-inbox"
import type { SlackSubjectInput } from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/format"
import { MIN_AI_CONFIDENCE } from "@/server/inbox/priority"

/** The specialist reviews, shown together as one « Expertise » tile. */
const EXPERTISE = ["security", "data", "infra"]
const EXPERTISE_LABEL: Record<string, string> = {
  security: "sécurité",
  data: "data / BDD",
  infra: "infra",
}

function tone(level: number, unsure: boolean) {
  if (unsure) return "text-muted-foreground"
  if (level >= 0.66) return "text-destructive"
  if (level >= 0.4) return "text-heat-foreground"
  return "text-diff-add-strong"
}

type Kind = "PR" | "issue"

const specsFor = (kind: Kind) => (kind === "PR" ? INSIGHTS : ISSUE_INSIGHTS)

/** The tiles as they will appear, so the loading state has the same shape. */
function tileLabels(kind: Kind) {
  const specs = specsFor(kind).filter((spec) => !EXPERTISE.includes(spec.id))
  return [
    ...specs.map((spec) => spec.label),
    ...(kind === "PR" ? ["Expertise requise"] : []),
  ]
}

/** One fixed-height row per line, shared by tiles and their placeholders. */
const TILE_CLASS =
  "flex h-14 min-w-0 flex-col justify-center gap-0.5 rounded-md border bg-background px-2.5"
const CARD_CLASS =
  "flex flex-col gap-3 rounded-lg border border-primary/20 bg-accent/40 p-4"

const formatConfidence = (confidence: number | null) =>
  confidence === null ? "non fournie" : `${Math.round(confidence * 100)} %`

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
  return (
    <TileFrame label={label} hint={hint}>
      <span
        className={cn("truncate text-sm font-semibold", tone(level, unsure))}
      >
        {value}
      </span>
      {unsure && (
        <span className="rounded border border-dashed px-1 text-[0.6rem] text-muted-foreground">
          incertain
        </span>
      )}
    </TileFrame>
  )
}

/** What Jev answered, on the KPI's own scale, for the tile's hover. */
function Scale({ spec, insight }: { spec: InsightSpec; insight: PullInsight }) {
  if (spec.kind === "yesno")
    return (
      <span>
        Probabilité de « {spec.yes.toLowerCase()} » :{" "}
        <span className="font-mono">{Math.round(insight.value * 100)} %</span>{" "}
        <span className="opacity-70">(« {spec.yes} » à partir de 50 %)</span>
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
            {level} : {spec.meanings[index]}
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
            Confiance de Jev : {formatConfidence(insight.confidence)}.
            {unsure
              ? " C'est sous 50 % : Jev n'est pas sûr de lui, cette valeur est donnée à titre indicatif. Vérifie toi-même."
              : " Au-dessus de 50 %, la réponse est jugée fiable."}
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
  const noun = kind === "PR" ? "la PR" : "l'issue"
  return (
    <header className="flex h-6 items-center gap-2">
      <GaugeIcon className="size-4 text-primary" />
      <h3 className="text-sm font-semibold">KPI Jev</h3>
      <span className="text-xs text-muted-foreground">
        {createdAt
          ? timeAgo(createdAt)
          : `Jev évalue ${noun}… (quelques secondes)`}
      </span>
      <Hint
        instant
        content={
          <span className="flex max-w-80 flex-col gap-1">
            <span className="font-medium">Comment lire ces KPI</span>
            <span>
              {kind === "PR"
                ? "Jev, le modèle de décision de l'app, les estime d'après la description, les commentaires, la CI, les fichiers et le début du diff."
                : "Jev, le modèle de décision de l'app, les estime d'après la description, les labels et les derniers commentaires."}{" "}
              Survole une tuile pour son échelle.
            </span>
            <span>
              <span className="text-diff-add-strong">Vert</span> : rien à
              signaler · <span className="text-heat-foreground">orange</span> :
              à surveiller · <span className="text-destructive">rouge</span> : à
              regarder.
            </span>
            <span>
              « incertain » : Jev a moins de 50 % de confiance dans sa réponse.
            </span>
            <span className="opacity-70">
              Le résultat est gardé 20 minutes ; ↻ le recalcule.
            </span>
          </span>
        }
        className="flex cursor-help text-muted-foreground"
      >
        <InfoIcon className="size-3.5" />
      </Hint>
      {onRefresh && (
        <Hint
          content={`Recalcule les KPI avec l'état actuel de ${noun}.`}
          className="ml-auto flex"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Recalculer les KPI Jev"
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
  const { data, isPending, error } = useQuery(insightsQuery(itemKey, subject))
  const refresh = useRefreshInsights(itemKey, subject)

  if (isPending)
    return (
      <section className={CARD_CLASS} aria-busy>
        <Header kind={kind} createdAt={null} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tileLabels(kind).map((label) => (
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
        KPI Jev indisponibles : {error.message}
      </p>
    )
  if (!data.available) return null

  const byId = new Map(data.insights.map((insight) => [insight.id, insight]))
  const main = specsFor(kind).filter(
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
    <section aria-label="KPI Jev" className={CARD_CLASS}>
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
            label="Expertise requise"
            value={
              required.length === 0
                ? "Aucune"
                : required
                    .map((insight) => EXPERTISE_LABEL[insight.id])
                    .join(", ")
            }
            level={required.length === 0 ? 0 : 0.5}
            unsure={false}
            hint={
              <span className="flex max-w-80 flex-col gap-1">
                <span className="font-medium">Expertise requise</span>
                <span>
                  Domaines qu'une personne spécialisée devrait valider avant le
                  merge.
                </span>
                {experts.map((insight) => (
                  <span key={insight.id} className="font-mono opacity-80">
                    {EXPERTISE_LABEL[insight.id]} :{" "}
                    {Math.round(insight.value * 100)} % (confiance{" "}
                    {formatConfidence(insight.confidence)})
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
