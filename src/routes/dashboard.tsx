import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  CloudIcon,
  CloudLightningIcon,
  FlameIcon,
  SunIcon,
  TimerIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { LeadPage, todayLabel } from "@/components/inbox/lead-page"
import { Hint } from "@/components/inbox/hint"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { dashboardQuery } from "@/hooks/use-inbox"
import { avatarUrl, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Dashboard } from "@/server/dashboard/dashboard"
import type { Weather } from "@/server/dashboard/weather"
import { formatMinutes } from "@/server/dashboard/workload"
import { TEAM_PROBLEM_LABEL, reviewerLabel } from "@/server/team/labels"

export const Route = createFileRoute("/dashboard")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardQuery()),
  component: DashboardPage,
})

type ActiveView = "review" | "awaiting" | "mine"

/** One colour per folder, shared by the ruler, its legend and the action list. */
const VIEW_TONE: Record<ActiveView, { bar: string; dot: string }> = {
  review: { bar: "bg-signal", dot: "bg-signal" },
  awaiting: { bar: "bg-heat", dot: "bg-heat" },
  mine: { bar: "bg-diff-add-strong", dot: "bg-diff-add-strong" },
}

const asActive = (view: string): ActiveView =>
  view === "awaiting" || view === "mine" ? view : "review"

/**
 * The page's signature: the waiting work laid end to end on an hour ruler,
 * one segment per action, so the size of the day reads at a glance.
 */
function WorkRuler({ workload }: { workload: Dashboard["workload"] }) {
  const total = Math.max(workload.totalMinutes, 1)
  const hours = Math.floor(workload.totalMinutes / 60)
  const ticks = Array.from({ length: hours + 1 }, (_, hour) => hour)
  const shown = workload.actions.reduce((sum, a) => sum + a.minutes, 0)
  const rest = workload.totalMinutes - shown

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-md bg-strip">
        {workload.actions.map((action, index) => (
          <Hint
            key={action.key}
            instant
            className="flex min-w-1"
            style={{ flexGrow: action.minutes, flexBasis: 0 }}
            content={
              <>
                <span className="font-medium">
                  {index + 1}. {action.label} · {formatMinutes(action.minutes)}
                </span>
                <span className="opacity-80">{action.title}</span>
              </>
            }
          >
            <Link
              to="/"
              search={{ folder: asActive(action.view), item: action.key }}
              aria-label={`${action.label} : ${action.title}`}
              className={cn(
                "block h-full w-full transition-opacity hover:opacity-80",
                VIEW_TONE[asActive(action.view)].bar
              )}
            />
          </Hint>
        ))}
        {rest > 0 && (
          <Hint
            instant
            className="flex"
            style={{ flexGrow: rest, flexBasis: 0 }}
            content={`Le reste de la file · ${formatMinutes(rest)}`}
          >
            <span className="block h-full w-full bg-[repeating-linear-gradient(135deg,var(--color-muted-foreground)_0_1px,transparent_1px_6px)] opacity-40" />
          </Hint>
        )}
      </div>
      <div className="relative h-4 font-mono text-[0.65rem] text-muted-foreground tabular-nums">
        {/* A tick too close to the end would overflow the ruler. */}
        {ticks
          .filter((hour) => hour === 0 || (hour * 60) / total < 0.95)
          .map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0"
              style={{ left: `${((hour * 60) / total) * 100}%` }}
            >
              {hour === 0 ? "maintenant" : `+${hour} h`}
            </span>
          ))}
      </div>
    </div>
  )
}

function Hero({ data }: { data: Dashboard }) {
  const { workload } = data
  const legend: { view: ActiveView; label: string }[] = [
    { view: "review", label: "Reviews" },
    { view: "awaiting", label: "Réponses" },
    { view: "mine", label: "Mes PR" },
  ]
  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Ta file de travail
            </p>
            <h2 className="font-heading text-5xl leading-none font-semibold tracking-tight tabular-nums">
              {workload.totalMinutes === 0
                ? "Zéro Ping"
                : formatMinutes(workload.totalMinutes)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {workload.totalMinutes === 0
                ? "Rien ne t'attend. Profites-en."
                : "de travail t'attend, estimé d'après la taille des PR et les messages."}
            </p>
          </div>
          <dl className="flex gap-5 text-sm">
            {legend.map(({ view, label }) => (
              <div key={view} className="flex flex-col gap-0.5">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn("size-2 rounded-full", VIEW_TONE[view].dot)}
                  />
                  {label}
                </dt>
                <dd className="font-mono tabular-nums">
                  <span className="font-medium">{workload.counts[view]}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatMinutes(workload.byView[view]).replace("≈ ", "")}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {workload.totalMinutes > 0 && <WorkRuler workload={workload} />}
      </CardContent>
    </Card>
  )
}

function NextActions({ data }: { data: Dashboard }) {
  const { actions } = data.workload
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prochaines actions</CardTitle>
        <CardDescription>Dans l'ordre de priorité.</CardDescription>
        <CardAction>
          <Button
            variant="link"
            size="xs"
            nativeButton={false}
            render={<Link to="/" search={{ folder: "review" }} />}
          >
            Ouvrir l'inbox
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune action en attente de ta part.
          </p>
        ) : (
          <ol className="flex flex-col">
            {actions.map((action, index) => (
              <li key={action.key}>
                <Link
                  to="/"
                  search={{ folder: asActive(action.view), item: action.key }}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                >
                  <span className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "h-8 w-1 shrink-0 rounded-full",
                      VIEW_TONE[asActive(action.view)].bar
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{action.label}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">
                        {action.repoFullName.split("/")[1]}#{action.number}
                      </span>{" "}
                      · {action.title}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {formatMinutes(action.minutes)}
                  </span>
                  <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

const WEATHER: Record<
  Weather,
  { icon: LucideIcon; label: string; tone: string }
> = {
  sunny: { icon: SunIcon, label: "Fluide", tone: "text-diff-add-strong" },
  cloudy: { icon: CloudIcon, label: "Chargé", tone: "text-muted-foreground" },
  stormy: {
    icon: CloudLightningIcon,
    label: "Bloqué ou débordé",
    tone: "text-heat-foreground",
  },
}

/** Ten dots: one per review due, filled up to ten. */
function LoadDots({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 10 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-1.5 rounded-full",
            index < count ? "bg-foreground/70" : "bg-strip"
          )}
        />
      ))}
      {count > 10 && (
        <span className="ml-1 font-mono text-[0.65rem]">+{count - 10}</span>
      )}
    </span>
  )
}

function TeamWeather({ data }: { data: Dashboard }) {
  const rows = data.weather
  return (
    <Card>
      <CardHeader>
        <CardTitle>Météo de l'équipe</CardTitle>
        <CardDescription>
          Reviews dues et PR bloquées de chacun, d'après les repos suivis.
        </CardDescription>
        <CardAction>
          <Button
            variant="link"
            size="xs"
            nativeButton={false}
            render={<Link to="/team" />}
          >
            {data.team.stuck} PR à débloquer
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b pb-1.5 text-[0.7rem] text-muted-foreground">
          <span>Personne</span>
          <span>Reviews dues</span>
          <span className="w-24 text-right">PR bloquées</span>
        </div>
        {rows.map((row) => {
          const weather = WEATHER[row.weather]
          const Icon = weather.icon
          const waiting = row.waitingOn.map(reviewerLabel)
          return (
            <div
              key={row.login}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 border-b py-2 last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Hint instant className="flex" content={weather.label}>
                  <Icon className={cn("size-4", weather.tone)} />
                </Hint>
                <Avatar className="size-6">
                  <AvatarImage src={avatarUrl(row.login)} alt="" />
                  <AvatarFallback className="text-[0.55rem]">
                    {row.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">
                    @{row.login}
                    {row.isViewer && (
                      <span className="text-muted-foreground"> (toi)</span>
                    )}
                  </span>
                  {waiting.length > 0 && (
                    <span className="truncate text-[0.7rem] text-muted-foreground">
                      attend {waiting.join(", ")}
                    </span>
                  )}
                </span>
              </span>
              <Hint
                instant
                className="flex items-center gap-2"
                content={`${row.reviewsDue} review${row.reviewsDue > 1 ? "s" : ""} demandée${row.reviewsDue > 1 ? "s" : ""}`}
              >
                <LoadDots count={row.reviewsDue} />
                <span className="w-5 text-right font-mono text-xs tabular-nums">
                  {row.reviewsDue}
                </span>
              </Hint>
              <span className="flex w-24 flex-wrap justify-end gap-1">
                {row.blocked.length === 0 ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  row.blocked.map((pull) => (
                    <Hint
                      key={pull.number}
                      instant
                      className="flex"
                      content={pull.problems
                        .map((problem) => TEAM_PROBLEM_LABEL[problem])
                        .join(", ")}
                    >
                      <Badge variant="outline" className="font-mono">
                        #{pull.number}
                      </Badge>
                    </Hint>
                  ))
                )}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/** Paired bars per day: what arrived against what was handled. */
function FlowChart({ flow }: { flow: Dashboard["trends"]["flow"] }) {
  const max = Math.max(1, ...flow.flatMap((day) => [day.entered, day.left]))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-28 items-end gap-1.5">
        {flow.map((day) => {
          const date = new Date(`${day.date}T12:00:00`)
          const label = date.toLocaleDateString("fr", {
            weekday: "short",
            day: "numeric",
          })
          return (
            <Hint
              key={day.date}
              instant
              className="flex h-full flex-1 items-end gap-px"
              content={`${label} · ${day.entered} arrivé${day.entered > 1 ? "s" : ""}, ${day.left} traité${day.left > 1 ? "s" : ""}`}
            >
              <span
                className="w-1/2 rounded-t-sm bg-muted-foreground/35"
                style={{ height: `${(day.entered / max) * 100}%` }}
              />
              <span
                className="w-1/2 rounded-t-sm bg-signal"
                style={{ height: `${(day.left / max) * 100}%` }}
              />
            </Hint>
          )
        })}
      </div>
      <div className="flex gap-1.5 font-mono text-[0.6rem] text-muted-foreground">
        {flow.map((day, index) => (
          <span key={day.date} className="flex-1 text-center">
            {index % 2 === flow.length % 2 ? "" : Number(day.date.slice(8))}
          </span>
        ))}
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="font-heading text-2xl leading-none font-semibold tabular-nums">
        {value}
      </span>
      {detail && (
        <span className="text-[0.7rem] text-muted-foreground">{detail}</span>
      )}
    </div>
  )
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`.replace(".", ",")
  return `${Math.round(hours / 24)} j`
}

function Trends({ data }: { data: Dashboard }) {
  const { trends } = data
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendances</CardTitle>
        <CardDescription>
          Les 14 derniers jours : ce qui est arrivé dans « À reviewer » et « On
          t'attend », face à ce que tu as traité.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-muted-foreground/35" />
              Arrivés{" "}
              <span className="font-mono tabular-nums">
                {trends.enteredTotal}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-signal" />
              Traités{" "}
              <span className="font-mono tabular-nums">{trends.leftTotal}</span>
            </span>
          </div>
          <FlowChart flow={trends.flow} />
          {trends.noisyRepos.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                Repos les plus bavards
              </p>
              {trends.noisyRepos.map((repo) => (
                <div
                  key={repo.repo}
                  className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs"
                >
                  <span className="truncate font-mono">
                    {repo.repo.split("/")[1]}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-strip">
                    <span
                      className="block h-full rounded-full bg-foreground/50"
                      style={{ width: `${repo.share * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-muted-foreground tabular-nums">
                    {Math.round(repo.share * 100)} %
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Stat
            icon={TimerIcon}
            label="Délai de review"
            value={
              trends.medianReviewHours === null
                ? "—"
                : formatHours(trends.medianReviewHours)
            }
            detail={
              trends.reviewsMeasured > 0
                ? `médiane sur ${trends.reviewsMeasured} review${trends.reviewsMeasured > 1 ? "s" : ""}, 30 j`
                : "pas encore de review mesurée"
            }
          />
          <Stat
            icon={FlameIcon}
            label="Série Zéro Ping"
            value={`${trends.streak} j`}
            detail={
              trends.streakTracked
                ? "jours d'affilée où l'inbox est tombée à zéro"
                : "mesurée à partir d'aujourd'hui"
            }
          />
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:col-span-2">
            <span className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Hors SLA (plus de {trends.slaHours} h)</span>
              <span className="font-heading text-lg leading-none font-semibold text-foreground tabular-nums">
                {trends.overSla.length}
              </span>
            </span>
            {trends.overSla.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Toutes tes reviews sont dans les temps.
              </span>
            ) : (
              <ul className="flex flex-col gap-1">
                {trends.overSla.slice(0, 4).map((item) => (
                  <li key={item.key}>
                    <Link
                      to="/"
                      search={{ folder: "review", item: item.key }}
                      className="flex items-baseline gap-2 text-xs hover:underline"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-heat-foreground">
                        {timeAgo(item.requestedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const { data, isPending } = useQuery(dashboardQuery())
  return (
    <LeadPage
      page="dashboard"
      description={`${todayLabel()} · ta charge, tes prochaines actions, la météo de l'équipe et les tendances.`}
    >
      {isPending && (
        <>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-72 w-full" />
        </>
      )}
      {data && (
        <>
          <Hero data={data} />
          <div className="grid gap-4 xl:grid-cols-2">
            <NextActions data={data} />
            <TeamWeather data={data} />
          </div>
          <Trends data={data} />
          <p className="text-center text-xs text-muted-foreground">
            Estimations : 5 à 60 min par review selon la taille de la PR (moitié
            pour une re-review), 5 min par réponse, 2 à 20 min pour tes PR.
          </p>
        </>
      )}
    </LeadPage>
  )
}
