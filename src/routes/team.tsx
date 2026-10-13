import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import {
  ArrowRightIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  GitMergeIcon,
  HourglassIcon,
  MessageSquareWarningIcon,
  UserPlusIcon,
  UserRoundXIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { LeadPage } from "@/components/inbox/lead-page"
import { Hint } from "@/components/inbox/hint"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ReviewersMenu } from "@/components/inbox/reviewers-menu"
import { teamQuery, useTakeReview } from "@/hooks/use-inbox"
import { avatarUrl, pullSize, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { TeamProblem, TeamPull } from "@/server/db/schema"
import { ballHolder, diagnose } from "@/server/team/diagnosis"
import type { BallHolder } from "@/server/team/diagnosis"
import {
  TEAM_PREFIX,
  TEAM_PROBLEM_LABEL,
  reviewerLabel,
} from "@/server/team/labels"

export const Route = createFileRoute("/team")({
  loader: ({ context }) => context.queryClient.ensureQueryData(teamQuery()),
  component: TeamPage,
})

/** Problems in the order a lead can clear them fastest. */
const PROBLEMS: { problem: TeamProblem; icon: LucideIcon; hint: string }[] = [
  {
    problem: "no-reviewer",
    icon: UserRoundXIcon,
    hint: "Ni reviewer désigné, ni review faite : personne ne sait qu'elle attend.",
  },
  {
    problem: "changes",
    icon: MessageSquareWarningIcon,
    hint: "Des changements ont été demandés et l'auteur n'a rien poussé depuis plus de 2 jours.",
  },
  {
    problem: "ci",
    icon: XCircleIcon,
    hint: "La CI du dernier commit échoue : la PR ne peut pas être mergée en l'état.",
  },
  {
    problem: "conflict",
    icon: GitMergeIcon,
    hint: "La branche est en conflit avec la base : il faut rebaser.",
  },
  {
    problem: "stale",
    icon: HourglassIcon,
    hint: "Ouverte depuis plus longtemps que le seuil des réglages.",
  },
]
const PROBLEM_ICON = Object.fromEntries(
  PROBLEMS.map(({ problem, icon }) => [problem, icon])
) as Record<TeamProblem, LucideIcon>

/** One colour per problem, shared by the tags and the filters, to spot them at a glance. */
const PROBLEM_TONE: Record<TeamProblem, { tag: string; icon: string }> = {
  "no-reviewer": {
    tag: "border-signal/40 bg-signal/12 text-signal",
    icon: "text-signal",
  },
  changes: {
    tag: "border-heat/40 bg-heat/12 text-heat-foreground",
    icon: "text-heat-foreground",
  },
  ci: {
    tag: "border-destructive/40 bg-destructive/12 text-destructive",
    icon: "text-destructive",
  },
  conflict: {
    tag: "border-slack/40 bg-slack/12 text-slack",
    icon: "text-slack",
  },
  stale: {
    tag: "border-chart-3/40 bg-chart-3/12 text-chart-3",
    icon: "text-chart-3",
  },
}

function ProblemTag({ problem }: { problem: TeamProblem }) {
  const Icon = PROBLEM_ICON[problem]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 justify-self-start rounded-md border px-2 text-xs font-semibold whitespace-nowrap",
        PROBLEM_TONE[problem].tag
      )}
    >
      <Icon className="size-3.5" />
      {TEAM_PROBLEM_LABEL[problem]}
    </span>
  )
}

type Filter = "stuck" | "all" | TeamProblem

function PersonAvatar({
  login,
  size = "size-6",
}: {
  login: string
  size?: string
}) {
  return (
    <Avatar className={size}>
      <AvatarImage src={avatarUrl(login)} alt="" />
      <AvatarFallback className="text-[0.55rem]">
        {login.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

/** "La balle est chez…": the people who have to move next. */
function Holder({
  holder,
  viewerLogin,
}: {
  holder: BallHolder
  viewerLogin: string
}) {
  if (holder.kind === "lead")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-heat-foreground">
        <PersonAvatar login={viewerLogin} size="size-5" />
        Toi ou un reviewer
      </span>
    )
  const logins =
    holder.kind === "author"
      ? holder.login
        ? [holder.login]
        : []
      : holder.reviewers
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="flex -space-x-1.5">
        {logins
          .filter((login) => !login.startsWith(TEAM_PREFIX))
          .slice(0, 3)
          .map((login) => (
            <Hint key={login} instant className="flex" content={`@${login}`}>
              <PersonAvatar
                login={login}
                size="size-5 ring-2 ring-background"
              />
            </Hint>
          ))}
      </span>
      <span className="truncate">
        {logins.map(reviewerLabel).join(", ") || "l'auteur"}
        <span className="text-muted-foreground">
          {holder.kind === "author" ? " (auteur)" : " (review)"}
        </span>
      </span>
    </span>
  )
}

function TeamRow({
  pull,
  viewerLogin,
}: {
  pull: TeamPull
  viewerLogin: string
}) {
  const take = useTakeReview()
  const now = new Date()
  const diagnoses = diagnose(pull, now, viewerLogin)
  const holder = ballHolder(pull, now, viewerLogin)
  const isReviewer = pull.reviewers.some(
    (reviewer) => reviewer.toLowerCase() === viewerLogin.toLowerCase()
  )
  const [owner, name] = pull.repoFullName.split("/")
  const healthy = diagnoses.length === 0

  return (
    <li className="grid gap-x-5 gap-y-2 border-b px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <div className="flex min-w-0 gap-3">
        {pull.author && (
          <PersonAvatar login={pull.author} size="mt-0.5 size-7" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Link
            to="/"
            search={{ folder: "mine", scope: "all", item: pull.key }}
            className="text-sm leading-snug font-medium hover:underline"
          >
            {pull.title}
          </Link>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="font-mono">
              <span className="opacity-60">{owner}/</span>
              {name}
              <span className="opacity-60">#{pull.number}</span>
            </span>
            <span>· par @{pull.author ?? "fantôme"}</span>
            <span>· ouverte {timeAgo(pull.createdAt, now)}</span>
            <span>· dernière activité {timeAgo(pull.updatedAt, now)}</span>
            <Hint
              instant
              className="flex"
              content={
                <span className="font-mono">
                  +{pull.additions} −{pull.deletions}
                </span>
              }
            >
              <span className="rounded border px-1 font-mono text-[0.65rem] leading-4">
                {pullSize(pull.additions, pull.deletions)}
              </span>
            </Hint>
          </p>
          {healthy ? (
            <p className="flex items-center gap-1.5 text-xs text-diff-add-strong">
              <CircleCheckIcon className="size-3.5" />
              {pull.isDraft
                ? "Brouillon : l'auteur ne la considère pas encore prête."
                : "En bonne voie : reviewer désigné, CI et branche sans souci."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5 rounded-md border bg-muted/30 p-2.5">
              {diagnoses.map((diagnosis) => (
                <li
                  key={diagnosis.problem}
                  className="grid items-start gap-x-3 gap-y-1 text-xs sm:grid-cols-[13rem_minmax(0,1fr)]"
                >
                  <ProblemTag problem={diagnosis.problem} />
                  <span className="flex flex-col gap-0.5 sm:pt-1">
                    <span className="text-foreground">{diagnosis.reason}</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ArrowRightIcon className="size-3 shrink-0" />
                      {diagnosis.nextStep}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 max-lg:pl-10">
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] tracking-wide text-muted-foreground uppercase">
            La balle est chez
          </span>
          <Holder holder={holder} viewerLogin={viewerLogin} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {!isReviewer && !pull.isDraft && (
            <Hint content="Te désigne comme reviewer sur GitHub : la PR arrive dans « À reviewer » à la prochaine synchro.">
              <Button
                variant={holder.kind === "lead" ? "default" : "outline"}
                size="xs"
                onClick={() => take.mutate(pull.key)}
                disabled={take.isPending || take.isSuccess}
              >
                {take.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <UserPlusIcon data-icon="inline-start" />
                )}
                {take.isSuccess ? "Review prise" : "Prendre la review"}
              </Button>
            </Hint>
          )}
          <ReviewersMenu itemKey={pull.key} size="xs" />
          <Button
            variant="ghost"
            size="xs"
            nativeButton={false}
            render={<a href={pull.htmlUrl} target="_blank" rel="noreferrer" />}
          >
            GitHub
            <ExternalLinkIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </li>
  )
}

function TeamPage() {
  const { data, isPending } = useQuery(teamQuery())
  const [filter, setFilter] = useState<Filter>("stuck")
  const pulls = data?.pulls ?? []
  const stuck = pulls.filter((pull) => pull.problems.length > 0)
  const count = (problem: TeamProblem) =>
    pulls.filter((pull) => pull.problems.includes(problem)).length
  const shown =
    filter === "all"
      ? pulls
      : filter === "stuck"
        ? stuck
        : pulls.filter((pull) => pull.problems.includes(filter))
  const viewerLogin = data?.viewerLogin ?? ""

  const filterHint =
    filter === "stuck"
      ? "Les PR qui n'avancent pas, les plus anciennes d'abord."
      : filter === "all"
        ? "Toutes les PR ouvertes de l'équipe, les bloquées d'abord."
        : PROBLEMS.find(({ problem }) => problem === filter)?.hint

  return (
    <LeadPage
      page="team"
      description="Les PR ouvertes par l'équipe dans les repos suivis, hors les tiennes et celles des bots. Pour chaque PR bloquée : ce qui coince, ce qu'il faut faire, et qui doit agir."
      actions={
        data && (
          <p className="font-heading text-2xl leading-none font-semibold tabular-nums">
            {stuck.length}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {" "}
              bloquée{stuck.length > 1 ? "s" : ""} sur {pulls.length}
            </span>
          </p>
        )
      }
      toolbar={
        data && (
          <div className="flex flex-col gap-1.5">
            <ToggleGroup
              size="sm"
              value={[filter]}
              onValueChange={(value) => {
                if (value[0]) setFilter(value[0] as Filter)
              }}
              aria-label="Filtrer les PR"
              className="flex-wrap"
            >
              <ToggleGroupItem value="stuck">
                À débloquer
                <span className="font-mono text-xs tabular-nums">
                  {stuck.length}
                </span>
              </ToggleGroupItem>
              {PROBLEMS.filter(({ problem }) => count(problem) > 0).map(
                ({ problem, icon: Icon }) => (
                  <ToggleGroupItem key={problem} value={problem}>
                    <Icon className={PROBLEM_TONE[problem].icon} />
                    {TEAM_PROBLEM_LABEL[problem]}
                    <span className="font-mono text-xs tabular-nums">
                      {count(problem)}
                    </span>
                  </ToggleGroupItem>
                )
              )}
              <ToggleGroupItem value="all">
                Toutes
                <span className="font-mono text-xs tabular-nums">
                  {pulls.length}
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{filterHint}</p>
          </div>
        )
      }
    >
      {isPending && (
        <>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </>
      )}
      {data && shown.length === 0 && (
        <Empty className="rounded-xl border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>Rien de bloqué</EmptyTitle>
            <EmptyDescription>
              Toutes les PR de l'équipe ont un reviewer et avancent. La liste se
              met à jour toutes les 10 minutes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {shown.length > 0 && (
        <ul className="overflow-hidden rounded-xl border bg-card">
          {shown.map((pull) => (
            <TeamRow key={pull.key} pull={pull} viewerLogin={viewerLogin} />
          ))}
        </ul>
      )}
      {data && (
        <p className="text-center text-xs text-muted-foreground">
          « Ouverte depuis longtemps » : plus de {data.staleDays} jours,
          réglable dans Réglages &gt; Classement.
        </p>
      )}
    </LeadPage>
  )
}
