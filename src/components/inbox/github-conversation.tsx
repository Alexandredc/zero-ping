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
import { useI18n } from "@/hooks/use-i18n"

export type ReplyTarget =
  | { type: "conversation" }
  | {
      type: "thread"
      commentDatabaseId: number
      path: string
      author: string | null
    }

export function CommentBlock({
  comment,
  note,
}: {
  comment: ConversationComment
  note?: string
}) {
  const { language, t } = useI18n()
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
            {comment.author ?? t.detail.conversation.ghost}
          </span>
          {note && <span>{note}</span>}
          <a
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto hover:text-foreground hover:underline"
          >
            {timeAgo(comment.createdAt, language)}
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
  const { t } = useI18n()
  if (entry.type === "comment") return <CommentBlock comment={entry} />
  if (entry.type === "review") {
    return (
      <CommentBlock
        comment={entry}
        note={
          entry.state === "DISMISSED"
            ? t.detail.conversation.dismissed
            : (t.detail.reviewState(entry.state) ?? entry.state)
        }
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
            {t.detail.conversation.resolved}
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
          {t.detail.conversation.replyInThread}
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
  const { t } = useI18n()
  const copy = t.detail.conversation
  return (
    <section
      aria-label={copy.label}
      className="flex flex-col gap-5 rounded-lg border border-l-4 border-l-foreground/60 bg-card p-4"
    >
      <header className="flex items-center gap-2">
        <GitHubIcon />
        <h3 className="text-sm font-semibold">GitHub</h3>
        {conversation && (
          <span className="text-xs text-muted-foreground">
            {copy.messages(conversation.entries.length + 1)}
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
          <AlertTitle>{copy.unavailable}</AlertTitle>
          <AlertDescription>
            {copy.unavailableDetail(error.message)}
          </AlertDescription>
        </Alert>
      )}
      {!isPending && !error && conversation === null && (
        <p className="text-sm text-muted-foreground">{copy.unsupported}</p>
      )}
      {conversation && (
        <>
          <CommentBlock comment={conversation.description} note={copy.opened} />
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
