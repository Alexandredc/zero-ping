import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { ExternalLinkIcon, UserPlusIcon, UsersIcon } from "lucide-react"
import { Sidebar } from "@/components/inbox/sidebar"
import { Hint } from "@/components/inbox/hint"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { teamQuery, useTakeReview } from "@/hooks/use-inbox"
import { avatarUrl, pullSize, timeAgo } from "@/lib/format"
import type { TeamProblem, TeamPull } from "@/server/db/schema"
import { TEAM_PROBLEM_LABEL, reviewerLabel } from "@/server/team/labels"

export const Route = createFileRoute("/team")({
  loader: ({ context }) => context.queryClient.ensureQueryData(teamQuery()),
  component: TeamPage,
})

/** Sections in reading order: what a lead can unblock fastest comes first. */
const SECTIONS: { problem: TeamProblem; hint: string }[] = [
  {
    problem: "no-reviewer",
    hint: "Personne n'a été désigné et aucune review n'a été faite.",
  },
  {
    problem: "changes",
    hint: "Des changements ont été demandés et rien n'a bougé depuis 2 jours.",
  },
  { problem: "ci", hint: "La CI du dernier commit échoue." },
  { problem: "conflict", hint: "Conflits avec la branche de base." },
  {
    problem: "stale",
    hint: "Ouvertes depuis plus longtemps que le seuil choisi dans les réglages.",
  },
]

function TeamRow({
  pull,
  viewerLogin,
}: {
  pull: TeamPull
  viewerLogin: string
}) {
  const take = useTakeReview()
  const isReviewer = pull.reviewers.some(
    (reviewer) => reviewer.toLowerCase() === viewerLogin.toLowerCase()
  )
  const [owner, name] = pull.repoFullName.split("/")
  return (
    <li className="flex items-start gap-3 border-b px-5 py-3 last:border-b-0">
      <Avatar className="mt-0.5 size-7">
        <AvatarImage src={avatarUrl(pull.author)} alt="" />
        <AvatarFallback className="text-[0.6rem]">
          {(pull.author ?? "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate font-mono">
            <span className="opacity-60">{owner}/</span>
            {name}
            <span className="opacity-60">#{pull.number}</span>
          </span>
          <span>· @{pull.author ?? "fantôme"}</span>
          <span>· ouverte {timeAgo(pull.createdAt)}</span>
        </p>
        <a
          href={pull.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-sm leading-snug hover:underline"
        >
          {pull.title}
        </a>
        <p className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
          {pull.problems.map((problem) => (
            <Badge key={problem} variant="outline">
              {TEAM_PROBLEM_LABEL[problem]}
            </Badge>
          ))}
          <Hint
            content={
              <span className="font-mono">
                +{pull.additions} −{pull.deletions}
              </span>
            }
          >
            <span className="font-mono">
              {pullSize(pull.additions, pull.deletions)}
            </span>
          </Hint>
          {pull.reviewers.length > 0 && (
            <span>
              · reviewers : {pull.reviewers.map(reviewerLabel).join(", ")}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!isReviewer && (
          <Hint content="Te désigne comme reviewer sur GitHub : la PR arrive dans « À reviewer ».">
            <Button
              variant="outline"
              size="sm"
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
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <a
              href={pull.htmlUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Ouvrir sur GitHub"
            />
          }
        >
          <ExternalLinkIcon />
        </Button>
      </div>
    </li>
  )
}

function TeamPage() {
  const { data, isPending } = useQuery(teamQuery())
  const pulls = data?.pulls ?? []
  // Each PR is listed once, under its most blocking problem.
  const sections = SECTIONS.map((section) => ({
    ...section,
    pulls: pulls.filter((pull) => pull.problems[0] === section.problem),
  })).filter((section) => section.pulls.length > 0)

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar page="team" />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-5 py-3">
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Équipe
          </h1>
          <p className="text-xs text-muted-foreground">
            {data
              ? `${pulls.length} PR à débloquer sur ${data.total} ouvertes dans les repos suivis, hors les tiennes et celles des bots.`
              : "PR des repos suivis qui n'avancent pas."}
          </p>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          {isPending && (
            <div className="flex flex-col gap-3 p-5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {data && sections.length === 0 && (
            <Empty className="py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersIcon />
                </EmptyMedia>
                <EmptyTitle>Rien de bloqué</EmptyTitle>
                <EmptyDescription>
                  Toutes les PR de l'équipe ont un reviewer et avancent. La
                  liste se met à jour toutes les 10 minutes.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {sections.map((section) => (
            <section key={section.problem}>
              <header className="sticky top-0 z-10 flex items-baseline gap-2 border-b bg-background/95 px-5 py-2 backdrop-blur">
                <h2 className="text-sm font-semibold">
                  {TEAM_PROBLEM_LABEL[section.problem]}
                </h2>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {section.pulls.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {section.hint}
                </span>
              </header>
              <ul>
                {section.pulls.map((pull) => (
                  <TeamRow
                    key={pull.key}
                    pull={pull}
                    viewerLogin={data?.viewerLogin ?? ""}
                  />
                ))}
              </ul>
            </section>
          ))}
        </ScrollArea>
      </main>
    </div>
  )
}
