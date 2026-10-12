import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import {
  CheckIcon,
  ExternalLinkIcon,
  PlayIcon,
  RotateCwIcon,
  SendIcon,
} from "lucide-react"
import { Sidebar } from "@/components/inbox/sidebar"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { recapQuery, usePublishStandup, useRunStandup } from "@/hooks/use-inbox"
import { timeAgo } from "@/lib/format"
import type { Item } from "@/server/db/schema"

export const Route = createFileRoute("/recap")({
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
  blocker,
  posted,
  postedLink,
}: {
  blocker: string | null
  posted: boolean
  postedLink: string | null
}) {
  const [open, setOpen] = useState(false)
  const publish = usePublishStandup()

  if (posted)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckIcon className="size-4 text-diff-add-strong" />
        Publié dans le fil du Daily standup.
        {postedLink && (
          <a
            href={postedLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Voir dans Slack
            <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </p>
    )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={<Button size="sm" disabled={blocker !== null} />}
        >
          <SendIcon data-icon="inline-start" />
          Publier dans #tech-team-general
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publier le standup ?</DialogTitle>
            <DialogDescription>
              Le message part en ton nom dans le fil du « Daily standup reminder
              » d'aujourd'hui, sur #tech-team-general. Chaque personne citée
              reçoit une notification Slack.
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
      {blocker && (
        <span className="text-xs text-muted-foreground">{blocker}</span>
      )}
    </div>
  )
}

function StandupCard() {
  const { data } = useQuery(recapQuery())
  const run = useRunStandup()
  if (!data) return null
  const { standup } = data
  const running = standup.status === "running" || run.isPending
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlackIcon className="size-4" aria-hidden />
          Standup de l'équipe
        </CardTitle>
        <CardDescription>
          {running
            ? `Lancé ${timeAgo(standup.startedAt)} : l'export du board prend environ 6 minutes.`
            : standup.finishedAt
              ? `Généré ${timeAgo(standup.finishedAt)} par /standup:team.`
              : data.standupEnabled
                ? `Lancé automatiquement les jours ouvrés à ${data.recapTime}, ou à la main.`
                : "Le lancement automatique est coupé dans les réglages."}
        </CardDescription>
        <CardAction>
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
        {standup.message && !running && (
          <PublishStandup
            blocker={data.publishBlocker}
            postedLink={standup.postedLink}
            posted={standup.postedAt !== null}
          />
        )}
      </CardContent>
    </Card>
  )
}

function RecapPage() {
  const { data, isPending } = useQuery(recapQuery())
  const today = new Date().toLocaleDateString("fr", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar page="recap" />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-5 py-3">
          <h1 className="font-heading text-lg font-semibold tracking-tight first-letter:uppercase">
            {today}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.line ?? "Préparation du récap…"}
          </p>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">
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
                  <TopList
                    folder="mine"
                    items={data.mine}
                    count={data.mine.length}
                  />
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
                <StandupCard />
              </>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
