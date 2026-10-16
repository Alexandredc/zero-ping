import { useQuery } from "@tanstack/react-query"
import { FullscreenToggle } from "@/components/inbox/fullscreen-toggle"
import { useEffect, useRef, useState } from "react"
import {
  CheckIcon,
  ClockIcon,
  GitBranchIcon,
  MessageSquareReplyIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { SlackDiscussions } from "./slack-discussions"
import { SummaryCard } from "./summary-card"
import { ItemInsights } from "./item-insights"
import { GitHubConversation } from "./github-conversation"
import type { ReplyTarget } from "./github-conversation"
import { ActionHint, Hint } from "./hint"
import { AiReviewMenu } from "./ai-review-menu"
import { DiffView } from "./diff-view"
import { MergeMenu } from "./merge-menu"
import { MentionTextarea } from "./mention-textarea"
import { ReviewersMenu } from "./reviewers-menu"
import { ProjectFields } from "./project-fields"
import { UatBadge } from "./uat-badge"
import type { PendingReview, ReviewEvent } from "./review-dialog"
import { FailedChecks } from "./failed-checks"
import { ReadinessCard } from "./merge-readiness"
import { ChecksBar, ChecksIndicator } from "./checks-indicator"
import { LinkedIssues } from "./linked-issues"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/components/ui/toast"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { useI18n } from "@/hooks/use-i18n"
import { GitHubIcon } from "@/components/brand-icons"
import type { PriorityReason } from "@/server/inbox/priority"
import type { Item } from "@/server/db/schema"
import {
  conversationQuery,
  linkedIssuesQuery,
  useInboxActions,
} from "@/hooks/use-inbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { avatarUrl, formatWhen, nextMorning } from "@/lib/format"

function PriorityExplanation({
  priority,
  reasons,
  needsCheck,
}: {
  priority: number
  reasons: PriorityReason[]
  needsCheck: boolean
}) {
  const { t } = useI18n()
  const counted = reasons.filter((reason) => reason.weight !== 0)
  if (counted.length === 0 && !needsCheck) return null
  return (
    <section className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t.detail.priority.title(priority)}
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
              <span className="font-medium">
                {t.detail.priority.needsCheck}
              </span>{" "}
              · {t.detail.priority.needsCheckHint}
            </span>
          </li>
        )}
      </ul>
    </section>
  )
}

/** The author, big enough to recognise; the name on hover, for a missing photo. */
function AuthorAvatar({ login, isPull }: { login: string; isPull: boolean }) {
  const { t } = useI18n()
  return (
    <Hint
      instant
      content={t.detail.panel.openedBy(isPull, login)}
      className="shrink-0"
    >
      <Avatar className="size-10">
        <AvatarImage src={avatarUrl(login, 88)} alt={login} />
        <AvatarFallback>{login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
    </Hint>
  )
}

/** The PR's branch into its base; a click copies the branch, for a checkout. */
function BranchName({
  branches,
}: {
  branches: { head: string; base: string }
}) {
  const { t } = useI18n()
  return (
    <ActionHint content={t.detail.panel.copyBranch(branches.head)}>
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(branches.head).then(() =>
            toast.add({
              title: t.detail.panel.branchCopied,
              description: branches.head,
            })
          )
        }
        className="inline-flex max-w-full min-w-0 items-center gap-1 rounded align-baseline font-mono text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GitBranchIcon className="size-3.5 shrink-0" />
        <span className="max-w-64 truncate">{branches.head}</span>
        <span aria-hidden>→</span>
        <span className="truncate">{branches.base}</span>
      </button>
    </ActionHint>
  )
}

export function DetailPanel({
  item,
  inInbox = true,
  composerRef,
  onClose,
  fullscreen = false,
  onToggleFullscreen,
  onReview,
}: {
  item: Item
  /** False for a teammate's PR outside the inbox: nothing to mark done or snooze. */
  inInbox?: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onClose: () => void
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  /** Opens the page's confirmation dialog for an approval or a change request. */
  onReview: (review: PendingReview) => void
}) {
  const { t, language } = useI18n()
  const { data, isPending, error } = useQuery(conversationQuery(item.key))
  const actions = useInboxActions()
  const [body, setBody] = useState("")
  const [target, setTarget] = useState<ReplyTarget>({ type: "conversation" })
  const [tab, setTab] = useState<"conversation" | "files" | "issue">(
    "conversation"
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const isPull = item.kind === "PullRequest"
  const linked = useQuery({
    ...linkedIssuesQuery(item.key),
    enabled: isPull,
  })
  const linkedIssues = linked.data ?? []

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
  // Anyone can review an open PR but its author: no review request needed.
  const canReview =
    item.kind === "PullRequest" && item.state === "OPEN" && item.view !== "mine"
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
      label: t.detail.panel.snoozeIn3Hours,
      until: () => new Date(Date.now() + 3 * 3600_000),
    },
    { label: t.detail.panel.snoozeTomorrowMorning, until: () => nextMorning() },
    { label: t.detail.panel.snoozeMondayMorning, until: () => nextMorning(1) },
  ]

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
      aria-label={t.detail.panel.label}
    >
      {isPull && <ChecksBar itemKey={item.key} />}
      <header className="flex flex-col gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-mono text-xs text-muted-foreground">
              {item.repoFullName}
              {item.number !== null && `#${item.number}`}
            </p>
            {conversation?.branches && (
              <BranchName branches={conversation.branches} />
            )}
            {isPull && <ChecksIndicator itemKey={item.key} />}
          </div>
          {onToggleFullscreen && (
            <FullscreenToggle
              fullscreen={fullscreen}
              onToggle={onToggleFullscreen}
            />
          )}
          <ActionHint content={t.detail.panel.closeHint}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={t.common.close}
            >
              <XIcon />
            </Button>
          </ActionHint>
        </div>
        <div className="flex items-center gap-3">
          {item.author && <AuthorAvatar login={item.author} isPull={isPull} />}
          <h2 className="min-w-0 font-heading text-xl leading-tight font-semibold tracking-tight">
            {item.title}
          </h2>
        </div>
        {item.number !== null &&
          (item.kind === "PullRequest" || item.kind === "Issue") && (
            <div className="flex flex-wrap items-center gap-1.5">
              <ProjectFields itemKey={item.key} />
              {isPull && <UatBadge itemKey={item.key} />}
            </div>
          )}
        <div className="flex flex-wrap items-center gap-2">
          <ActionHint
            content={
              item.awaitingUrl
                ? t.detail.panel.openOnGitHubAwaitingHint
                : t.detail.panel.openOnGitHubHint
            }
          >
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={githubUrl} target="_blank" rel="noreferrer" />}
            >
              <GitHubIcon data-icon="inline-start" />
              {t.common.openOnGitHub}
              <Kbd>o</Kbd>
            </Button>
          </ActionHint>
          {inInbox && (
            <>
              <ActionHint
                content={
                  isDone ? t.detail.panel.undoneHint : t.detail.panel.doneHint
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
                  {isDone ? t.detail.panel.undone : t.detail.panel.done}
                </Button>
              </ActionHint>
              <DropdownMenu>
                <ActionHint content={t.detail.panel.snoozeHint}>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="sm" />}
                  >
                    <ClockIcon data-icon="inline-start" />
                    {item.snoozedUntil && item.snoozedUntil > new Date()
                      ? t.detail.panel.snoozedUntil(
                          formatWhen(item.snoozedUntil, language)
                        )
                      : t.detail.panel.snooze}
                  </DropdownMenuTrigger>
                </ActionHint>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>
                      {t.detail.panel.snoozeMenuLabel}
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
                          {formatWhen(option.until(), language)}
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
                        {t.detail.panel.unsnooze}
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
          onValueChange={(value) =>
            setTab(value as "conversation" | "files" | "issue")
          }
          className="border-b px-5"
        >
          <TabsList variant="line" className="h-9">
            <TabsTrigger value="conversation">
              {t.detail.panel.tabs.conversation}
            </TabsTrigger>
            {linkedIssues.length > 0 && (
              <TabsTrigger value="issue">
                {linkedIssues.length > 1
                  ? t.detail.panel.tabs.issues(linkedIssues.length)
                  : t.detail.panel.tabs.issue(linkedIssues[0].number)}
              </TabsTrigger>
            )}
            <TabsTrigger value="files">
              {t.detail.panel.tabs.files}
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
        ) : tab === "issue" && linkedIssues.length > 0 ? (
          <div className="px-5 py-4">
            <LinkedIssues issues={linkedIssues} />
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
            {isPull && item.state === "OPEN" && item.readiness && (
              <ReadinessCard readiness={item.readiness} />
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
                <AlertTitle>
                  {t.detail.panel.awaitingTitle(item.awaitingFrom)}
                </AlertTitle>
                <AlertDescription>
                  <p className="line-clamp-3">{item.awaitingExcerpt}</p>
                  {item.awaitingUrl && (
                    <a
                      href={item.awaitingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {t.detail.panel.seeMessageOnGitHub}
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isPull && <SlackDiscussions itemKey={item.key} />}
            <GitHubConversation
              conversation={data ? conversation : undefined}
              isPending={isPending}
              error={error}
              onReplyInThread={setTarget}
            />
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {canReply && tab !== "issue" && (
        <footer className="flex flex-col gap-2 border-t bg-card px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitHubIcon className="size-3.5 text-foreground" />
            {target.type === "thread" ? (
              <>
                <span className="truncate">
                  {t.detail.composer.replyInThread}{" "}
                  <span className="font-mono">{target.path}</span>
                  {target.author && ` (@${target.author})`}
                </span>
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setTarget({ type: "conversation" })}
                >
                  {t.detail.composer.replyToConversation}
                </Button>
              </>
            ) : (
              <span>{t.detail.composer.commentOnConversation}</span>
            )}
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              <Kbd>r</Kbd> {t.detail.composer.keysWrite} <Kbd>⌘</Kbd>
              <Kbd>{t.detail.composer.keysEnter}</Kbd>{" "}
              {t.detail.composer.keysSend}
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
            placeholder={t.detail.composer.placeholder}
            className="max-h-60 min-h-20"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canReview && (
              <>
                {/* The span keeps the hint visible on a disabled button. */}
                <ActionHint
                  side="top"
                  content={t.detail.composer.requestChangesHint}
                >
                  <span className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => review("REQUEST_CHANGES")}
                      disabled={actions.review.isPending || !body.trim()}
                    >
                      {t.detail.composer.requestChanges}
                    </Button>
                  </span>
                </ActionHint>
                <ActionHint side="top" content={t.detail.composer.approveHint}>
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
                      {t.detail.composer.approve}
                    </Button>
                  </span>
                </ActionHint>
              </>
            )}
            <ActionHint
              side="top"
              content={
                target.type === "thread"
                  ? t.detail.composer.sendThreadHint
                  : t.detail.composer.sendConversationHint
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
                  {t.detail.composer.sendOnGitHub}
                </Button>
              </span>
            </ActionHint>
          </div>
        </footer>
      )}
    </section>
  )
}
