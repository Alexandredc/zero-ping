import {
  CircleDotIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  MessagesSquareIcon,
  SparklesIcon,
} from "lucide-react"
import { Hint } from "./hint"
import { SlackIcon } from "@/components/brand-icons"
import type { Item } from "@/server/db/schema"
import type { InboxItem } from "@/server/inbox/actions"
import type { PriorityReason } from "@/server/inbox/priority"
import { NEEDS_CHECK_HINT } from "@/server/inbox/priority"
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
function PriorityGauge({
  priority,
  reasons,
}: {
  priority: number
  reasons: PriorityReason[]
}) {
  const level = Math.max(0.08, priority / 100)
  return (
    <Hint
      side="right"
      className="relative flex w-9 shrink-0 flex-col items-center gap-1 pt-0.5"
      content={<ScoreBreakdown priority={priority} reasons={reasons} />}
    >
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
    </Hint>
  )
}

export function ScoreBreakdown({
  priority,
  reasons,
}: {
  priority: number
  reasons: PriorityReason[]
}) {
  const counted = reasons.filter((reason) => reason.weight !== 0)
  return (
    <>
      <span className="font-medium">Priorité {priority} sur 100</span>
      {counted.length > 0 ? (
        <span className="flex flex-col gap-0.5 font-mono">
          {counted.map((reason) => (
            <span key={reason.label}>
              {reason.weight > 0 ? "+" : "−"}
              {Math.abs(reason.weight)} {reason.label}
            </span>
          ))}
        </span>
      ) : (
        <span>
          Aucune règle ne s'applique : rien n'attend d'action de ta part.
        </span>
      )}
      <span className="opacity-70">
        Plus le score est haut, plus c'est à traiter tôt.
      </span>
    </>
  )
}

export function ItemStrip({
  item,
  selected,
  onSelect,
}: {
  item: InboxItem
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
      <PriorityGauge priority={item.priority} reasons={item.priorityReasons} />
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
            <Hint content="Non lu sur GitHub">
              <span
                className="block size-1.5 shrink-0 rounded-full bg-signal"
                aria-label="Non lu"
              />
            </Hint>
          )}
          {item.slackDiscussions !== null && item.slackDiscussions > 0 && (
            <Hint
              content={`${item.slackDiscussions} discussion${item.slackDiscussions > 1 ? "s" : ""} Slack sur cette PR`}
            >
              <span
                aria-label={`${item.slackDiscussions} discussion${item.slackDiscussions > 1 ? "s" : ""} Slack`}
                className="inline-flex items-center gap-1 rounded-full border border-slack/30 bg-slack-surface px-1.5 font-mono text-[0.7rem] text-foreground"
              >
                <SlackIcon className="size-3.5" aria-hidden />
                {item.slackDiscussions}
              </span>
            </Hint>
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
              <Hint
                key={reason.label}
                content={
                  reason.hint && (
                    <>
                      <span>{reason.hint}</span>
                      <span className="font-mono opacity-70">
                        {reason.weight > 0 ? "+" : "−"}
                        {Math.abs(reason.weight)} points
                      </span>
                    </>
                  )
                }
                className={cn(reason.hint && "cursor-help")}
              >
                {reason.weight < 0 && (
                  <span aria-label="baisse la priorité">↓ </span>
                )}
                {reason.label}
              </Hint>
            ))}
            {item.needsCheck && (
              <Hint
                content={NEEDS_CHECK_HINT}
                className="inline-flex cursor-help items-center gap-0.5 text-heat-foreground"
              >
                <SparklesIcon className="size-3" /> à vérifier
              </Hint>
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
