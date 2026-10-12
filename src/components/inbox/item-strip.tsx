import {
  ArchiveIcon,
  CircleDotIcon,
  GitCommitHorizontalIcon,
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
import {
  NEEDS_CHECK_HINT,
  hasNewCommitsSinceReview,
} from "@/server/inbox/priority"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { avatarUrl, pullSize, timeAgo } from "@/lib/format"

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

function kindLabel(item: Item): string {
  if (item.kind === "PullRequest")
    return item.isDraft ? "PR en brouillon" : "Pull request"
  if (item.kind === "Issue") return "Issue"
  return item.kind === "Discussion" ? "Discussion" : "Notification GitHub"
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

/** Size letter with the exact counts in its hint. */
function SizeChip({ item }: { item: Item }) {
  if (item.kind !== "PullRequest" || item.additions === null) return null
  const size = pullSize(item.additions, item.deletions)
  return (
    <Hint
      instant
      className="flex"
      content={
        <>
          <span>Taille de la PR : {size}</span>
          <span className="font-mono">
            +{item.additions} −{item.deletions ?? 0}
            {item.changedFiles !== null &&
              ` · ${item.changedFiles} fichier${item.changedFiles > 1 ? "s" : ""}`}
          </span>
        </>
      }
    >
      <span
        aria-label={`Taille ${size}`}
        className={cn(
          "inline-flex h-4 w-6 items-center justify-center rounded border px-1 font-mono text-[0.65rem] leading-none font-medium",
          size === "XS" || size === "S"
            ? "border-diff-add-strong/40 text-diff-add-strong"
            : size === "XL"
              ? "border-diff-del-strong/40 text-diff-del-strong"
              : "text-muted-foreground"
        )}
      >
        {size}
      </span>
    </Hint>
  )
}

export function ItemStrip({
  item,
  selected,
  checked,
  onCheck,
  onSelect,
}: {
  item: InboxItem
  selected: boolean
  checked: boolean
  onCheck: () => void
  onSelect: () => void
}) {
  const [repoOwner, repoName] = item.repoFullName.split("/")
  const reasons = item.priorityReasons
    .filter((reason) => reason.weight !== 0)
    .slice(0, 3)
  return (
    <div
      data-selected={selected || undefined}
      data-checked={checked || undefined}
      className={cn(
        "group/row flex w-full border-b transition-colors hover:bg-muted/60",
        "data-checked:bg-accent/60 data-selected:bg-accent data-selected:hover:bg-accent"
      )}
    >
      <span className="flex w-7 shrink-0 justify-end pt-3.5">
        <Checkbox
          aria-label={`Sélectionner ${item.title}`}
          checked={checked}
          onCheckedChange={onCheck}
          className={cn(
            "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100",
            checked && "opacity-100"
          )}
        />
      </span>
      <button
        type="button"
        onClick={(event) => (event.shiftKey ? onCheck() : onSelect())}
        className="group flex min-w-0 flex-1 gap-3 py-3 pr-3 pl-2 text-left outline-none focus-visible:bg-muted/60"
      >
        <PriorityGauge
          priority={item.priority}
          reasons={item.priorityReasons}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
            <Hint instant className="flex" content={kindLabel(item)}>
              <KindIcon item={item} />
            </Hint>
            <span className="truncate font-mono">
              <span className="opacity-60">{repoOwner}/</span>
              {repoName}
              {item.number !== null && (
                <span className="opacity-60">#{item.number}</span>
              )}
            </span>
            {item.unread && (
              <Hint instant className="flex" content="Non lu sur GitHub">
                <span
                  className="block size-1.5 shrink-0 rounded-full bg-signal"
                  aria-label="Non lu"
                />
              </Hint>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* Right-aligned from the date: the most frequent chips sit closest to it. */}
              {hasNewCommitsSinceReview(item) && (
                <Hint
                  instant
                  className="flex"
                  content="Des commits sont arrivés depuis ta dernière review : le diff peut se limiter à eux."
                >
                  <span
                    aria-label="Nouveaux commits depuis ta review"
                    className="inline-flex h-4 items-center rounded border border-signal/40 px-1 text-signal"
                  >
                    <GitCommitHorizontalIcon className="size-3" />
                  </span>
                </Hint>
              )}
              {item.slackDiscussions !== null && item.slackDiscussions > 0 && (
                <Hint
                  instant
                  className="flex"
                  content={`${item.slackDiscussions} discussion${item.slackDiscussions > 1 ? "s" : ""} Slack sur cette PR`}
                >
                  <span
                    aria-label={`${item.slackDiscussions} discussion${item.slackDiscussions > 1 ? "s" : ""} Slack`}
                    className="inline-flex h-4 items-center gap-1 rounded border border-slack/30 bg-slack-surface px-1 font-mono text-[0.65rem] leading-none font-medium text-foreground"
                  >
                    <SlackIcon className="size-3" aria-hidden />
                    {item.slackDiscussions}
                  </span>
                </Hint>
              )}
              <SizeChip item={item} />
              {/* Fixed width keeps the chips of every row in the same column. */}
              <span className="w-16 text-right tabular-nums">
                {timeAgo(item.updatedAt)}
              </span>
              {item.author && (
                <Hint
                  instant
                  className="flex"
                  content={`Auteur : @${item.author}`}
                >
                  <Avatar className="size-5">
                    <AvatarImage
                      src={avatarUrl(item.author)}
                      alt={item.author}
                    />
                    <AvatarFallback className="text-[0.55rem]">
                      {item.author.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Hint>
              )}
            </span>
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
          {item.doneAt && item.autoDoneReason && (
            <p className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
              <ArchiveIcon className="size-3" />
              Classé automatiquement · {item.autoDoneReason}
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
      </button>
    </div>
  )
}
