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
import { FOLDER_ICONS } from "@/components/inbox/folders"
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
import { publishBlocker } from "@/server/recap/standup-state"
import type { StandupKind } from "@/server/recap/standup-state"
import { useI18n } from "@/hooks/use-i18n"
import { timeAgo } from "@/lib/format"
import type { Item } from "@/server/db/schema"
import type { Language } from "@/lib/i18n/core"

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
  const { t } = useI18n()
  const Icon = FOLDER_ICONS[folder]
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 opacity-70" />
          {t.nav.folders[folder].label}
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
            {t.recap.page.seeAll}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.recap.page.nothingHere}
          </p>
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
  where,
}: {
  kind: StandupKind
  blocker: string | null
  /** Where the message goes, as a sentence ends: « dans le fil … sur #canal ». */
  where: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const publish = usePublishStandup(kind)
  const copy = t.recap.standup
  const { subject } = copy.kinds[kind]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ActionHint content={blocker ?? copy.publishHint(subject, where)}>
        {/* The span keeps the hint on a disabled button. */}
        <span className="inline-flex">
          <DialogTrigger
            render={<Button size="sm" disabled={blocker !== null} />}
          >
            <SlackIcon data-icon="inline-start" aria-hidden />
            {copy.publishOnSlack}
          </DialogTrigger>
        </span>
      </ActionHint>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.publishTitle(subject)}</DialogTitle>
          <DialogDescription>
            {copy.publishDescription(where)}
            {kind === "team" && copy.publishMentions}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t.common.cancel}
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
            {copy.publish}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StandupCard({ kind }: { kind: StandupKind }) {
  const { t, language } = useI18n()
  const { data } = useQuery(recapQuery())
  const run = useRunStandup(kind)
  if (!data) return null
  const { state: standup, enabled } = data.standups[kind]
  const copy = t.recap.standup
  const running = standup.status === "running" || run.isPending
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlackIcon className="size-4" aria-hidden />
          {copy.kinds[kind].title}
        </CardTitle>
        <CardDescription>
          {running
            ? copy.started(
                timeAgo(standup.startedAt, language),
                copy.kinds[kind].duration
              )
            : standup.finishedAt
              ? copy.generated(
                  timeAgo(standup.finishedAt, language),
                  data.standupCommands[kind]
                )
              : enabled
                ? copy.automatic(data.recapTime)
                : copy.automaticOff}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          {standup.message && !running && !standup.postedAt && (
            <PublishStandup
              kind={kind}
              blocker={publishBlocker(standup, kind, t)}
              where={copy.where(data.standupReminder, data.standupChannel)}
            />
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
            {standup.message ? copy.rerun : copy.run}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {standup.status === "error" && standup.error && (
          <Alert variant="destructive">
            <AlertTitle>{copy.failed}</AlertTitle>
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
            <p className="text-sm text-muted-foreground">{copy.none}</p>
          )
        )}
        {standup.postedAt && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckIcon className="size-4 text-diff-add-strong" />
            {copy.posted(timeAgo(standup.postedAt, language))}
            {standup.postedLink && (
              <a
                href={standup.postedLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {copy.viewInSlack}
                <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

const dayLabel = (iso: string, language: Language) =>
  new Date(iso).toLocaleDateString(language, { weekday: "short" })

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
  const { language } = useI18n()
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
              {dayLabel(entry.at, language)}
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
  const { t, language } = useI18n()
  const copyText = t.recap.week
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
      await navigator.clipboard.writeText(weekSummaryText(data, t))
      toast.add({ title: copyText.copied, type: "success" })
    } catch {
      toast.add({ title: copyText.copyFailed, type: "error" })
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copyText.title}</CardTitle>
        <CardDescription>
          {data
            ? copyText.since(
                new Date(data.since).toLocaleDateString(language, {
                  day: "numeric",
                  month: "long",
                })
              )
            : copyText.intro}
        </CardDescription>
        <CardAction>
          <ActionHint content={copyText.copyHint}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copy()}
              disabled={!data || empty}
            >
              <CopyIcon data-icon="inline-start" />
              {t.common.copy}
            </Button>
          </ActionHint>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending && <Skeleton className="h-24 w-full" />}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>{copyText.unavailable}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {empty && (
          <p className="text-sm text-muted-foreground">{copyText.empty}</p>
        )}
        {data && (
          <>
            <WeekBlock title={copyText.blocks.shipped} entries={data.shipped} />
            <WeekBlock title={copyText.blocks.started} entries={data.started} />
            <WeekBlock title={copyText.blocks.closed} entries={data.closed} />
            <WeekBlock
              title={copyText.blocks.reviewed}
              entries={data.reviewed}
              showAuthor
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RecapPage() {
  const { t, language } = useI18n()
  const { data, isPending } = useQuery(recapQuery())
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: "/recap" })

  return (
    <LeadPage
      page="recap"
      description={
        <>
          {todayLabel(language)} · {data?.line ?? t.recap.page.preparing}
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
                {t.recap.page.teamBlocked(data.counts.team)}
              </Link>
              <span className="text-muted-foreground">
                {t.recap.page.teamBlockedReasons}
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
              <TabsTrigger value="me">{t.recap.tabs.me}</TabsTrigger>
              <TabsTrigger value="team">{t.recap.tabs.team}</TabsTrigger>
              <TabsTrigger value="week">{t.recap.tabs.week}</TabsTrigger>
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
