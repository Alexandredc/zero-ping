import {
  CircleDotIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  MessagesSquareIcon,
  SparklesIcon,
} from "lucide-react"
import type { Item } from "@/server/db/schema"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { avatarUrl, timeAgo } from "@/lib/format"

function KindIcon({ item }: { item: Item }) {
  const className = "size-3.5 shrink-0"
  if (item.kind === "PullRequest") {
    return item.isDraft ? (
      <GitPullRequestDraftIcon className={className} />
    ) : (
      <GitPullRequestIcon className={className} />
    )
  }
  if (item.kind === "Issue") return <CircleDotIcon className={className} />
  return <MessagesSquareIcon className={className} />
}

/**
 * The strip's left gauge encodes the priority score: its height grows with the
 * score and the urgent tail turns to the heat colour.
 */
function PriorityGauge({ priority }: { priority: number }) {
  const level = Math.max(0.08, priority / 100)
  return (
    <div className="relative flex w-9 shrink-0 flex-col items-center gap-1 pt-0.5">
      <span
        className={cn(
          "font-mono text-xs font-medium tabular-nums",
          priority >= 60 ? "text-heat-foreground" : "text-muted-foreground"
        )}
      >
        {priority}
      </span>
      <div className="relative w-1 flex-1 overflow-hidden rounded-full bg-strip">
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500",
            priority >= 60 ? "bg-heat" : "bg-signal/70"
          )}
          style={{ height: `${level * 100}%` }}
        />
      </div>
    </div>
  )
}

export function ItemStrip({
  item,
  selected,
  onSelect,
}: {
  item: Item
  selected: boolean
  onSelect: () => void
}) {
  const [repoOwner, repoName] = item.repoFullName.split("/")
  const reasons = item.priorityReasons
    .filter((reason) => reason.weight !== 0)
    .slice(0, 3)
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected || undefined}
      className={cn(
        "group flex w-full gap-3 border-b px-3 py-3 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
        "data-selected:bg-accent data-selected:hover:bg-accent"
      )}
    >
      <PriorityGauge priority={item.priority} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <KindIcon item={item} />
          <span className="truncate font-mono">
            <span className="opacity-60">{repoOwner}/</span>
            {repoName}
            {item.number !== null && (
              <span className="opacity-60">#{item.number}</span>
            )}
          </span>
          {item.unread && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-signal"
              aria-label="Non lu"
            />
          )}
          <span className="ml-auto shrink-0">{timeAgo(item.updatedAt)}</span>
        </div>
        <p
          className={cn(
            "line-clamp-2 text-sm leading-snug",
            item.unread ? "font-medium" : "text-foreground/85"
          )}
        >
          {item.title}
        </p>
        {item.awaitingExcerpt && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">
              @{item.awaitingFrom}
            </span>{" "}
            {item.awaitingExcerpt}
          </p>
        )}
        {(reasons.length > 0 || item.needsCheck) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem] text-muted-foreground">
            {reasons.map((reason) => (
              <span key={reason.label}>
                {reason.weight < 0 && (
                  <span aria-label="baisse la priorité">↓ </span>
                )}
                {reason.label}
              </span>
            ))}
            {item.needsCheck && (
              <span className="inline-flex items-center gap-0.5 text-heat-foreground">
                <SparklesIcon className="size-3" /> à vérifier
              </span>
            )}
          </p>
        )}
      </div>
      {item.author && (
        <Avatar className="mt-0.5 size-6">
          <AvatarImage src={avatarUrl(item.author)} alt={item.author} />
          <AvatarFallback className="text-[0.6rem]">
            {item.author.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </button>
  )
}
