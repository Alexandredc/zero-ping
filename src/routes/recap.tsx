import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { z } from "zod"
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  PlayIcon,
  RotateCwIcon,
  SendIcon,
} from "lucide-react"
import { LeadPage, todayLabel } from "@/components/inbox/lead-page"
import { ActionHint } from "@/components/inbox/hint"
import { Markdown } from "@/components/inbox/markdown"
import { FOLDER_META } from "@/components/inbox/folders"
import { SlackIcon } from "@/components/brand-icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/toast"
import {
  recapQuery,
  usePublishStandup,
  useRunStandup,
  weekQuery,
} from "@/hooks/use-inbox"
import { clip, weekSummaryText } from "@/server/recap/week"
import type { WeekEntry } from "@/server/recap/week"
import type { StandupKind } from "@/server/recap/standup"
import { timeAgo } from "@/lib/format"
import type { Item } from "@/server/db/schema"

const TABS = ["me", "team", "week"] as const

export const Route = createFileRoute("/recap")({
  validateSearch: z.object({ tab: z.enum(TABS).default("me") }),
  loader: ({ context }) => context.queryClient.ensureQueryData(recapQuery()),
  component: RecapPage,
})

function TopList({
  folder,
  items,
  count,
}: {
  folder: "review" | "awaiting" | "mine"
  items: Item[]
  count: number
}) {
  const meta = FOLDER_META[folder]
  const Icon = meta.icon
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 opacity-70" />
          {meta.label}
          <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
            {count}
          </span>
        </CardTitle>
        <CardAction>
          <Button
            variant="link"
            size="xs"
            nativeButton={false}
            render={<Link to="/" search={{ folder }} />}
          >
            Tout voir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien ici.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  to="/"
                  search={{ folder, item: item.key }}
                  className="flex items-baseline gap-2 text-sm hover:underline"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {item.priority}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {item.repoFullName.split("/")[1]}#{item.number}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Posts the standup in today's "Daily standup reminder" thread. Posting
 * notifies everyone mentioned, so it asks once before sending.
 */
function PublishStandup({
  kind,
  blocker,
}: {
  kind: StandupKind
  blocker: string | null
}) {
  const [open, setOpen] = useState(false)
  const publish = usePublishStandup(kind)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ActionHint
        content={
          blocker ??
          `Publie ${STANDUP_COPY[kind].subject} en ton nom dans le fil du « Daily standup reminder » d'aujourd'hui, sur #tech-team-general. Une confirmation est demandée avant l'envoi.`
        }
      >
        {/* The span keeps the hint on a disabled button. */}
        <span className="inline-flex">
          <DialogTrigger
            render={<Button size="sm" disabled={blocker !== null} />}
          >
            <SlackIcon data-icon="inline-start" aria-hidden />
            Publier sur Slack
          </DialogTrigger>
        </span>
      </ActionHint>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publier {STANDUP_COPY[kind].subject} ?</DialogTitle>
          <DialogDescription>
            Le message part en ton nom dans le fil du « Daily standup reminder »
            d'aujourd'hui, sur #tech-team-general.
            {kind === "team" &&
              " Chaque personne citée reçoit une notification Slack."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Annuler
          </DialogClose>
          <Button
            onClick={() =>
              publish.mutate(undefined, { onSuccess: () => setOpen(false) })
            }
            disabled={publish.isPending}
          >
            {publish.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            Publier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const STANDUP_COPY: Record<
  StandupKind,
  { title: string; subject: string; command: string; duration: string }
> = {
  me: {
    title: "Mon standup",
    subject: "ton standup",
    command: "/standup",
    duration: "la lecture de tes PR prend une à deux minutes",
  },
  team: {
    title: "Standup de l'équipe",
    subject: "le standup de l'équipe",
    command: "/standup:team",
    duration: "l'export du board prend environ 6 minutes",
  },
}

function StandupCard({ kind }: { kind: StandupKind }) {
  const { data } = useQuery(recapQuery())
  const run = useRunStandup(kind)
  if (!data) return null
  const { state: standup, publishBlocker, enabled } = data.standups[kind]
  const copy = STANDUP_COPY[kind]
  const running = standup.status === "running" || run.isPending
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlackIcon className="size-4" aria-hidden />
          {copy.title}
        </CardTitle>
        <CardDescription>
          {running
            ? `Lancé ${timeAgo(standup.startedAt)} : ${copy.duration}.`
            : standup.finishedAt
              ? `Généré ${timeAgo(standup.finishedAt)} par ${copy.command}.`
              : enabled
                ? `Lancé automatiquement les jours ouvrés à ${data.recapTime}, ou à la main.`
                : "Le lancement automatique est coupé dans les réglages."}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          {standup.message && !running && !standup.postedAt && (
            <PublishStandup kind={kind} blocker={publishBlocker} />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => run.mutate()}
            disabled={running}
          >
            {running ? (
              <Spinner data-icon="inline-start" />
            ) : standup.message ? (
              <RotateCwIcon data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" />
            )}
            {standup.message ? "Relancer" : "Lancer"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {standup.status === "error" && standup.error && (
          <Alert variant="destructive">
            <AlertTitle>Standup échoué</AlertTitle>
            <AlertDescription>{standup.error}</AlertDescription>
          </Alert>
        )}
        {standup.note && (
          <Alert>
            <AlertDescription>{standup.note}</AlertDescription>
          </Alert>
        )}
        {standup.message ? (
          <Markdown>{standup.message}</Markdown>
        ) : (
          !running && (
            <p className="text-sm text-muted-foreground">
              Pas encore de standup aujourd'hui.
            </p>
          )
        )}
        {standup.postedAt && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-diff-add-strong" />
            Publié dans le fil du Daily standup {timeAgo(standup.postedAt)}.
            {standup.postedLink && (
              <a
                href={standup.postedLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Voir dans Slack
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("fr", { weekday: "short" })

function WeekBlock({
  title,
  entries,
  showAuthor = false,
}: {
  title: string
  entries: WeekEntry[]
  /** Reviews name whose PR it was rather than its number. */
  showAuthor?: boolean
}) {
  if (entries.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold">
        {title}{" "}
        <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
          {entries.length}
        </span>
      </h3>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-baseline gap-2">
            <span className="w-9 shrink-0 text-xs text-muted-foreground">
              {dayLabel(entry.at)}
            </span>
            <span className="min-w-0">
              <span title={entry.label}>{clip(entry.label)}</span>{" "}
              {entry.count > 1 ? (
                <span className="font-mono text-xs text-muted-foreground">
                  ×{entry.count}
                </span>
              ) : (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {showAuthor && entry.author
                    ? `@${entry.author}`
                    : `#${entry.number}`}
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** What the viewer did since Monday, rebuilt from GitHub so it grows through the week. */
function WeekCard() {
  const { data, isPending, error } = useQuery(weekQuery())
  const empty =
    data &&
    data.shipped.length +
      data.started.length +
      data.reviewed.length +
      data.closed.length ===
      0
  const copy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(weekSummaryText(data))
      toast.add({ title: "Résumé copié", type: "success" })
    } catch {
      toast.add({ title: "Copie impossible", type: "error" })
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ma semaine</CardTitle>
        <CardDescription>
          {data
            ? `Depuis lundi ${new Date(data.since).toLocaleDateString("fr", { day: "numeric", month: "long" })}, dans les repos suivis. Se complète tout seul au fil de la semaine.`
            : "Ce que tu as fait depuis lundi, dans les repos suivis."}
        </CardDescription>
        <CardAction>
          <ActionHint content="Copie le résumé en liste à puces, à coller dans le chat de la réunion.">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copy()}
              disabled={!data || empty}
            >
              <CopyIcon data-icon="inline-start" />
              Copier
            </Button>
          </ActionHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending && <Skeleton className="h-24 w-full" />}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Résumé indisponible</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {empty && (
          <p className="text-sm text-muted-foreground">
            Rien encore cette semaine : les PR mergées, ouvertes, reviewées et
            les issues fermées apparaîtront ici.
          </p>
        )}
        {data && (
          <>
            <WeekBlock title="Livré" entries={data.shipped} />
            <WeekBlock title="Lancé" entries={data.started} />
            <WeekBlock title="Fermé" entries={data.closed} />
            <WeekBlock title="Reviewé" entries={data.reviewed} showAuthor />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecapPage() {
  const { data, isPending } = useQuery(recapQuery())
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: "/recap" })

  return (
    <LeadPage
      page="recap"
      description={
        <>
          {todayLabel()} · {data?.line ?? "Préparation du récap…"}
        </>
      }
    >
      {isPending && <Skeleton className="h-40 w-full" />}
      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <TopList
              folder="review"
              items={data.review}
              count={data.counts.review}
            />
            <TopList
              folder="awaiting"
              items={data.awaiting}
              count={data.counts.awaiting}
            />
            <TopList folder="mine" items={data.mine} count={data.mine.length} />
          </div>
          {data.counts.team > 0 && (
            <p className="text-sm">
              <Link to="/team" className="font-medium hover:underline">
                {data.counts.team} PR de l'équipe à débloquer
              </Link>{" "}
              <span className="text-muted-foreground">
                : sans reviewer, en échec ou qui traînent.
              </span>
            </p>
          )}
          <Tabs
            value={tab}
            onValueChange={(value) =>
              void navigate({
                search: { tab: value as (typeof TABS)[number] },
                replace: true,
              })
            }
            className="gap-3"
          >
            <TabsList variant="line">
              <TabsTrigger value="me">Mon standup</TabsTrigger>
              <TabsTrigger value="team">Standup de l'équipe</TabsTrigger>
              <TabsTrigger value="week">Ma semaine</TabsTrigger>
            </TabsList>
            <TabsContent value="me">
              <StandupCard kind="me" />
            </TabsContent>
            <TabsContent value="team">
              <StandupCard kind="team" />
            </TabsContent>
            <TabsContent value="week">
              <WeekCard />
            </TabsContent>
          </Tabs>
        </>
      )}
    </LeadPage>
  )
}
