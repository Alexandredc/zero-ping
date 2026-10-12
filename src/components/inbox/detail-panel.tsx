import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  MessageSquareReplyIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { Markdown } from "./markdown"
import type { Item } from "@/server/db/schema"
import type {
  ConversationComment,
  ConversationEntry,
} from "@/server/github/conversation"
import { conversationQuery, useInboxActions } from "@/hooks/use-inbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { avatarUrl, nextMorning, timeAgo } from "@/lib/format"

type ReplyTarget =
  | { type: "conversation" }
  | {
      type: "thread"
      commentDatabaseId: number
      path: string
      author: string | null
    }

const REVIEW_STATE_LABEL: Record<string, string> = {
  APPROVED: "a approuvé",
  CHANGES_REQUESTED: "a demandé des changements",
  COMMENTED: "a commenté",
  DISMISSED: "review rejetée",
}

function CommentBlock({
  comment,
  note,
}: {
  comment: ConversationComment
  note?: string
}) {
  return (
    <article className="flex gap-3" id={comment.id}>
      <Avatar className="size-7">
        <AvatarImage
          src={comment.authorAvatar ?? avatarUrl(comment.author)}
          alt=""
        />
        <AvatarFallback className="text-[0.6rem]">
          {(comment.author ?? "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <header className="flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {comment.author ?? "fantôme"}
          </span>
          {note && <span>{note}</span>}
          <a
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto hover:text-foreground hover:underline"
          >
            {timeAgo(comment.createdAt)}
          </a>
        </header>
        {comment.body.trim() && <Markdown>{comment.body}</Markdown>}
      </div>
    </article>
  )
}

function Entry({
  entry,
  onReplyInThread,
}: {
  entry: ConversationEntry
  onReplyInThread: (target: ReplyTarget) => void
}) {
  if (entry.type === "comment") return <CommentBlock comment={entry} />
  if (entry.type === "review") {
    return (
      <CommentBlock
        comment={entry}
        note={REVIEW_STATE_LABEL[entry.state] ?? entry.state}
      />
    )
  }
  const first = entry.comments[0]
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <header className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileCodeIcon className="size-3.5" />
        <span className="truncate font-mono">
          {entry.path}
          {entry.line !== null && `:${entry.line}`}
        </span>
        {entry.isResolved && (
          <Badge variant="secondary" className="ml-auto">
            Résolu
          </Badge>
        )}
      </header>
      {entry.comments.map((comment) => (
        <CommentBlock key={comment.id} comment={comment} />
      ))}
      {!entry.isResolved && first.databaseId !== null && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() =>
            onReplyInThread({
              type: "thread",
              commentDatabaseId: first.databaseId!,
              path: entry.path,
              author: entry.comments[entry.comments.length - 1].author,
            })
          }
        >
          <MessageSquareReplyIcon data-icon="inline-start" />
          Répondre dans ce fil
        </Button>
      )}
    </section>
  )
}

export function DetailPanel({
  item,
  composerRef,
  onClose,
}: {
  item: Item
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onClose: () => void
}) {
  const { data, isPending, error } = useQuery(conversationQuery(item.key))
  const actions = useInboxActions()
  const [body, setBody] = useState("")
  const [target, setTarget] = useState<ReplyTarget>({ type: "conversation" })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setBody("")
    setTarget({ type: "conversation" })
  }, [item.key])

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

  const review = (event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT") =>
    actions.review.mutate(
      { key: item.key, event, body },
      { onSuccess: () => setBody("") }
    )

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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Fermer"
          >
            <XIcon />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<a href={githubUrl} target="_blank" rel="noreferrer" />}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            Ouvrir sur GitHub
            <Kbd>o</Kbd>
          </Button>
          <Button
            variant={isDone ? "outline" : "default"}
            size="sm"
            onClick={() =>
              actions.done.mutate({ key: item.key, done: !isDone })
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <ClockIcon data-icon="inline-start" />
              Mettre en pause
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {snoozeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.label}
                    onClick={() =>
                      actions.snooze.mutate({
                        key: item.key,
                        until: option.until(),
                      })
                    }
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
                {item.snoozedUntil && (
                  <DropdownMenuItem
                    onClick={() =>
                      actions.snooze.mutate({ key: item.key, until: null })
                    }
                  >
                    Reprendre maintenant
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-5 py-4">
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

          {isPending && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Conversation indisponible</AlertTitle>
              <AlertDescription>
                {error.message}. Ouvre-la sur GitHub en attendant.
              </AlertDescription>
            </Alert>
          )}
          {data && !conversation && (
            <p className="text-sm text-muted-foreground">
              Ce type de notification ne s'affiche pas ici. Ouvre-la sur GitHub.
            </p>
          )}
          {conversation && (
            <>
              <CommentBlock
                comment={conversation.description}
                note="a ouvert"
              />
              {conversation.entries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  onReplyInThread={setTarget}
                />
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {canReply && (
        <footer className="flex flex-col gap-2 border-t bg-card px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {target.type === "thread" ? (
              <>
                <span className="truncate">
                  Réponse dans le fil{" "}
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
              <span>Commentaire sur la conversation</span>
            )}
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              <Kbd>r</Kbd> pour écrire, <Kbd>⌘</Kbd>
              <Kbd>Entrée</Kbd> pour envoyer
            </span>
          </div>
          <Textarea
            ref={composerRef}
            value={body}
            onChange={(event) => setBody(event.target.value)}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => review("REQUEST_CHANGES")}
                  disabled={actions.review.isPending || !body.trim()}
                >
                  Demander des changements
                </Button>
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
              </>
            )}
            <Button
              size="sm"
              onClick={send}
              disabled={!body.trim() || actions.reply.isPending}
            >
              {actions.reply.isPending && <Spinner data-icon="inline-start" />}
              Envoyer
            </Button>
          </div>
        </footer>
      )}
    </section>
  )
}
