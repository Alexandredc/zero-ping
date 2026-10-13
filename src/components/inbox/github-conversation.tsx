import { GitHubIcon } from "@/components/brand-icons"
import { FileCodeIcon, MessageSquareReplyIcon } from "lucide-react"
import { Markdown } from "./markdown"
import type {
  Conversation,
  ConversationComment,
  ConversationEntry,
} from "@/server/github/conversation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { avatarUrl, timeAgo } from "@/lib/format"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

export type ReplyTarget =
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

export function CommentBlock({
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

export function Entry({
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

/**
 * The GitHub source of a PR or an issue, as one card: its header stays put
 * while the conversation loads, so PRs and issues look the same.
 */
export function GitHubConversation({
  conversation,
  isPending,
  error,
  onReplyInThread,
}: {
  /** Null when GitHub has no conversation to show for this item. */
  conversation: Conversation | null | undefined
  isPending: boolean
  error: Error | null
  onReplyInThread: (target: ReplyTarget) => void
}) {
  return (
    <section
      aria-label="Conversation GitHub"
      className="flex flex-col gap-5 rounded-lg border border-l-4 border-l-foreground/60 bg-card p-4"
    >
      <header className="flex items-center gap-2">
        <GitHubIcon />
        <h3 className="text-sm font-semibold">GitHub</h3>
        {conversation && (
          <span className="text-xs text-muted-foreground">
            {conversation.entries.length + 1} message
            {conversation.entries.length > 0 ? "s" : ""}
          </span>
        )}
      </header>
      {isPending && (
        <div className="flex flex-col gap-3" aria-busy>
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
      {!isPending && !error && conversation === null && (
        <p className="text-sm text-muted-foreground">
          Ce type de notification ne s'affiche pas ici. Ouvre-la sur GitHub.
        </p>
      )}
      {conversation && (
        <>
          <CommentBlock comment={conversation.description} note="a ouvert" />
          {conversation.entries.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              onReplyInThread={onReplyInThread}
            />
          ))}
        </>
      )}
    </section>
  )
}
