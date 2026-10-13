import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  MessageSquareReplyIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { SlackDiscussions } from "./slack-discussions"
import { SummaryCard } from "./summary-card"
import { ItemInsights } from "./item-insights"
import { GitHubConversation } from "./github-conversation"
import type { ReplyTarget } from "./github-conversation"
import { ActionHint } from "./hint"
import { AiReviewMenu } from "./ai-review-menu"
import { DiffView } from "./diff-view"
import { MergeMenu } from "./merge-menu"
import { MentionTextarea } from "./mention-textarea"
import { ReviewersMenu } from "./reviewers-menu"
import type { PendingReview, ReviewEvent } from "./review-dialog"
import { FailedChecks } from "./failed-checks"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { GitHubIcon, SlackIcon } from "@/components/brand-icons"
import { useConversationSources } from "@/hooks/use-conversation-sources"
import { NEEDS_CHECK_HINT } from "@/server/inbox/priority"
import type { PriorityReason } from "@/server/inbox/priority"
import type { Item } from "@/server/db/schema"
import { conversationQuery, useInboxActions } from "@/hooks/use-inbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { formatWhen, nextMorning } from "@/lib/format"

function PriorityExplanation({
  priority,
  reasons,
  needsCheck,
}: {
  priority: number
  reasons: PriorityReason[]
  needsCheck: boolean
}) {
  const counted = reasons.filter((reason) => reason.weight !== 0)
  if (counted.length === 0 && !needsCheck) return null
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <h3 className="text-xs font-medium text-muted-foreground">
        Pourquoi la priorité {priority} sur 100
      </h3>
      <ul className="flex flex-col gap-1.5 text-xs">
        {counted.map((reason) => (
          <li key={reason.label} className="flex gap-2">
            <span className="w-8 shrink-0 text-right font-mono tabular-nums">
              {reason.weight > 0 ? "+" : "−"}
              {Math.abs(reason.weight)}
            </span>
            <span>
              <span className="font-medium">{reason.label}</span>
              {reason.hint && (
                <span className="text-muted-foreground"> · {reason.hint}</span>
              )}
            </span>
          </li>
        ))}
        {needsCheck && (
          <li className="flex gap-2 text-heat-foreground">
            <span className="w-8 shrink-0 text-right font-mono">?</span>
            <span>
              <span className="font-medium">À vérifier</span> ·{" "}
              {NEEDS_CHECK_HINT}
            </span>
          </li>
        )}
      </ul>
    </section>
  )
}

export function DetailPanel({
  item,
  inInbox = true,
  composerRef,
  onClose,
  onReview,
}: {
  item: Item
  /** False for a teammate's PR outside the inbox: nothing to mark done or snooze. */
  inInbox?: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onClose: () => void
  /** Opens the page's confirmation dialog for an approval or a change request. */
  onReview: (review: PendingReview) => void
}) {
  const { data, isPending, error } = useQuery(conversationQuery(item.key))
  const actions = useInboxActions()
  const [body, setBody] = useState("")
  const [target, setTarget] = useState<ReplyTarget>({ type: "conversation" })
  const [tab, setTab] = useState<"conversation" | "files">("conversation")
  const bottomRef = useRef<HTMLDivElement>(null)
  const isPull = item.kind === "PullRequest"
  const { sources, toggle: toggleSource } = useConversationSources()

  useEffect(() => {
    setBody("")
    setTarget({ type: "conversation" })
    setTab("conversation")
  }, [item.key])

  useHotkeys({
    d: () =>
      isPull &&
      setTab((current) => (current === "files" ? "conversation" : "files")),
  })

  const conversation = data?.conversation ?? null
  const canReply = item.kind === "PullRequest" || item.kind === "Issue"
  const canReview =
    item.kind === "PullRequest" &&
    item.state === "OPEN" &&
    item.view === "review"
  const isDone = item.doneAt !== null
  const githubUrl = item.awaitingUrl ?? item.htmlUrl

  const send = () => {
    if (!body.trim() || actions.reply.isPending) return
    actions.reply.mutate(
      {
        key: item.key,
        body,
        target:
          target.type === "thread"
            ? { type: "thread", commentDatabaseId: target.commentDatabaseId }
            : { type: "conversation" },
      },
      { onSuccess: () => setBody("") }
    )
  }

  // The page confirms the review, with its Slack message, in a dialog.
  const review = (event: ReviewEvent) =>
    onReview({ key: item.key, event, body, onSent: () => setBody("") })

  const snoozeOptions = [
    {
      label: "Dans 3 heures",
      until: () => new Date(Date.now() + 3 * 3600_000),
    },
    { label: "Demain matin", until: () => nextMorning() },
    { label: "Lundi matin", until: () => nextMorning(1) },
  ]

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
      aria-label="Détail"
    >
      <header className="flex flex-col gap-3 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-mono text-xs text-muted-foreground">
              {item.repoFullName}
              {item.number !== null && `#${item.number}`}
            </p>
            <h2 className="font-heading text-xl leading-tight font-semibold tracking-tight">
              {item.title}
            </h2>
          </div>
          <ActionHint content="Fermer le détail (Échap)">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Fermer"
            >
              <XIcon />
            </Button>
          </ActionHint>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionHint
            content={
              item.awaitingUrl
                ? "Ouvre GitHub directement sur le message qui attend ta réponse (o)."
                : "Ouvre la PR ou l'issue sur GitHub dans un nouvel onglet (o)."
            }
          >
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={githubUrl} target="_blank" rel="noreferrer" />}
            >
              <GitHubIcon data-icon="inline-start" />
              Ouvrir sur GitHub
              <Kbd>o</Kbd>
            </Button>
          </ActionHint>
          {inInbox && (
            <>
              <ActionHint
                content={
                  isDone
                    ? "Remet l'élément dans son dossier de l'inbox (e)."
                    : "Retire l'élément de l'inbox et le marque « Done » dans tes notifications GitHub (e). Il revient tout seul s'il y a du nouveau."
                }
              >
                <Button
                  variant={isDone ? "outline" : "default"}
                  size="sm"
                  onClick={() =>
                    actions.done.mutate({ keys: [item.key], done: !isDone })
                  }
                  disabled={actions.done.isPending}
                >
                  {isDone ? (
                    <Undo2Icon data-icon="inline-start" />
                  ) : (
                    <CheckIcon data-icon="inline-start" />
                  )}
                  {isDone ? "Remettre dans l'inbox" : "Marquer comme traité"}
                  <Kbd>e</Kbd>
                </Button>
              </ActionHint>
              <DropdownMenu>
                <ActionHint content="Cache l'élément jusqu'à l'heure choisie, puis le fait revenir dans son dossier. En attendant, il est rangé dans « En pause ». Rien ne change sur GitHub.">
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" />}
                  >
                    <ClockIcon data-icon="inline-start" />
                    {item.snoozedUntil && item.snoozedUntil > new Date()
                      ? `En pause jusqu'à ${formatWhen(item.snoozedUntil)}`
                      : "Mettre en pause"}
                  </DropdownMenuTrigger>
                </ActionHint>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      Faire revenir cet élément…
                    </DropdownMenuLabel>
                    {snoozeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.label}
                        onClick={() =>
                          actions.snooze.mutate({
                            keys: [item.key],
                            until: option.until(),
                          })
                        }
                      >
                        {option.label}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatWhen(option.until())}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    {item.snoozedUntil && (
                      <DropdownMenuItem
                        onClick={() =>
                          actions.snooze.mutate({
                            keys: [item.key],
                            until: null,
                          })
                        }
                      >
                        Reprendre maintenant
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {isPull && item.state === "OPEN" && item.view === "mine" && (
            <MergeMenu
              itemKey={item.key}
              approved={item.reviewDecision === "APPROVED"}
            />
          )}
          {isPull && item.state === "OPEN" && (
            <ReviewersMenu itemKey={item.key} />
          )}
          {isPull && item.state === "OPEN" && (
            <AiReviewMenu itemKey={item.key} />
          )}
        </div>
      </header>

      {isPull && (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "conversation" | "files")}
          className="border-b px-5"
        >
          <TabsList variant="line" className="h-9">
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label="Choisir les sources de la conversation"
                    className="-ml-1"
                  />
                }
              >
                {sources.github && <GitHubIcon className="size-3.5" />}
                {sources.slack && (
                  <SlackIcon className="size-3.5" aria-hidden />
                )}
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    Afficher dans la conversation
                  </DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={sources.github}
                    onCheckedChange={(checked) => {
                      toggleSource("github", checked)
                      setTab("conversation")
                    }}
                  >
                    <GitHubIcon className="size-3.5" />
                    GitHub
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sources.slack}
                    onCheckedChange={(checked) => {
                      toggleSource("slack", checked)
                      setTab("conversation")
                    }}
                  >
                    <SlackIcon className="size-3.5" aria-hidden />
                    Slack
                  </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <TabsTrigger value="files">
              Fichiers modifiés
              {item.additions !== null && (
                <span className="font-mono text-xs tabular-nums">
                  <span className="text-diff-add-strong">
                    +{item.additions}
                  </span>{" "}
                  <span className="text-diff-del-strong">
                    −{item.deletions ?? 0}
                  </span>
                </span>
              )}
              <Kbd>d</Kbd>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {tab === "files" && isPull ? (
          <div className="px-5 py-4">
            <DiffView item={item} />
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-5 py-4">
            {canReply && (
              <ItemInsights
                itemKey={item.key}
                kind={item.kind === "PullRequest" ? "PR" : "issue"}
              />
            )}
            {canReply && (
              <SummaryCard
                itemKey={item.key}
                kind={item.kind === "PullRequest" ? "PR" : "issue"}
              />
            )}
            {isPull &&
              item.state === "OPEN" &&
              (item.ciState === "FAILURE" || item.ciState === "ERROR") && (
                <FailedChecks itemKey={item.key} />
              )}
            <PriorityExplanation
              priority={item.priority}
              reasons={item.priorityReasons}
              needsCheck={item.needsCheck}
            />
            {item.awaitingMe && item.awaitingExcerpt && (
              <Alert>
                <MessageSquareReplyIcon />
                <AlertTitle>@{item.awaitingFrom} attend ta réponse</AlertTitle>
                <AlertDescription>
                  <p className="line-clamp-3">{item.awaitingExcerpt}</p>
                  {item.awaitingUrl && (
                    <a
                      href={item.awaitingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      Voir le message sur GitHub
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isPull && sources.slack && <SlackDiscussions itemKey={item.key} />}
            {(!isPull || sources.github) && (
              <GitHubConversation
                conversation={data ? conversation : undefined}
                isPending={isPending}
                error={error}
                onReplyInThread={setTarget}
              />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {canReply && (
        <footer className="flex flex-col gap-2 border-t bg-card px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitHubIcon className="size-3.5 text-foreground" />
            {target.type === "thread" ? (
              <>
                <span className="truncate">
                  Réponse dans le fil GitHub{" "}
                  <span className="font-mono">{target.path}</span>
                  {target.author && ` (@${target.author})`}
                </span>
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setTarget({ type: "conversation" })}
                >
                  Répondre à la conversation
                </Button>
              </>
            ) : (
              <span>Commentaire sur la conversation GitHub</span>
            )}
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              <Kbd>r</Kbd> pour écrire, <Kbd>⌘</Kbd>
              <Kbd>Entrée</Kbd> pour envoyer
            </span>
          </div>
          <MentionTextarea
            ref={composerRef}
            repo={item.repoFullName}
            value={body}
            onValueChange={setBody}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                send()
              }
              if (event.key === "Escape") event.currentTarget.blur()
            }}
            placeholder="Écris ta réponse en Markdown…"
            className="max-h-60 min-h-20"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canReview && (
              <>
                {/* The span keeps the hint visible on a disabled button. */}
                <ActionHint
                  side="top"
                  content="Envoie une review « Changes requested » avec ton texte comme commentaire : la PR ne peut plus être mergée sans nouvelle approbation. Écris d'abord ce qu'il faut changer."
                >
                  <span className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => review("REQUEST_CHANGES")}
                      disabled={actions.review.isPending || !body.trim()}
                    >
                      Demander des changements
                    </Button>
                  </span>
                </ActionHint>
                <ActionHint
                  side="top"
                  content="Envoie une review « Approve » sur GitHub, avec ton texte en commentaire s'il y en a un."
                >
                  <span className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => review("APPROVE")}
                      disabled={actions.review.isPending}
                    >
                      {actions.review.isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <CheckIcon data-icon="inline-start" />
                      )}
                      Approuver
                    </Button>
                  </span>
                </ActionHint>
              </>
            )}
            <ActionHint
              side="top"
              content={
                target.type === "thread"
                  ? "Publie ta réponse dans ce fil de review sur GitHub (⌘ Entrée)."
                  : "Publie ton texte comme commentaire sur la conversation GitHub, sans review (⌘ Entrée)."
              }
            >
              <span className="inline-flex">
                <Button
                  size="sm"
                  onClick={send}
                  disabled={!body.trim() || actions.reply.isPending}
                >
                  {actions.reply.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <GitHubIcon data-icon="inline-start" />
                  )}
                  Envoyer sur GitHub
                </Button>
              </span>
            </ActionHint>
          </div>
        </footer>
      )}
    </section>
  )
}
