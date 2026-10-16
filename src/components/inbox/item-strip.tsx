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
import { JevGauge } from "./jev-gauge"
import { CiIcon } from "./ci-icon"
import { ReadinessLine } from "./merge-readiness"
import { SlackIcon } from "@/components/brand-icons"
import type { Item } from "@/server/db/schema"
import type { InboxItem } from "@/server/inbox/actions"
import type { PriorityReason } from "@/server/inbox/priority"
import { hasNewCommitsSinceReview } from "@/server/inbox/priority"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { avatarUrl, pullSize, timeAgo } from "@/lib/format"
import { useI18n } from "@/hooks/use-i18n"
import type { Messages } from "@/lib/i18n/messages"

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

function kindLabel(item: Item, t: Messages): string {
  const kinds = t.inbox.strip.kinds
  if (item.kind === "PullRequest")
    return item.isDraft ? kinds.draftPull : kinds.pull
  if (item.kind === "Issue") return kinds.issue
  return item.kind === "Discussion" ? kinds.discussion : kinds.notification
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
  const { t } = useI18n()
  const counted = reasons.filter((reason) => reason.weight !== 0)
  return (
    <>
      <span className="font-medium">{t.inbox.strip.score(priority)}</span>
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
        <span>{t.inbox.strip.noRule}</span>
      )}
      <span className="opacity-70">{t.inbox.strip.scoreHelp}</span>
    </>
  )
}

/** Size letter with the exact counts in its hint. */
function SizeChip({ item }: { item: Item }) {
  const { t } = useI18n()
  if (item.kind !== "PullRequest" || item.additions === null) return null
  const size = pullSize(item.additions, item.deletions)
  return (
    <Hint
      instant
      className="flex"
      content={
        <>
          <span>{t.inbox.strip.sizeTitle(size)}</span>
          <span className="font-mono">
            +{item.additions} −{item.deletions ?? 0}
            {item.changedFiles !== null &&
              ` · ${t.inbox.strip.files(item.changedFiles)}`}
          </span>
        </>
      }
    >
      <span
        aria-label={t.inbox.strip.size(size)}
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
  gauge = "priority",
}: {
  item: InboxItem
  selected: boolean
  checked: boolean
  onCheck: () => void
  onSelect: () => void
  /** « Toutes les PR » ranks by Jev alone, so its gauge shows Jev's urgency. */
  gauge?: "priority" | "jev"
}) {
  const { t, language } = useI18n()
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
      <span className="flex w-5 shrink-0 justify-end pt-3.5">
        <Checkbox
          aria-label={t.inbox.strip.select(item.title)}
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
        className="group flex min-w-0 flex-1 gap-2.5 py-3 pr-3 pl-1 text-left outline-none focus-visible:bg-muted/60"
      >
        {gauge === "jev" ? (
          <JevGauge urgency={item.jevUrgency} />
        ) : (
          <PriorityGauge
            priority={item.priority}
            reasons={item.priorityReasons}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
            <Hint instant className="flex" content={kindLabel(item, t)}>
              <KindIcon item={item} />
            </Hint>
            <span className="truncate font-mono">
              <span className="opacity-60">{repoOwner}/</span>
              {repoName}
              {item.number !== null && (
                <span className="opacity-60">#{item.number}</span>
              )}
            </span>
            {item.kind === "PullRequest" && <CiIcon ciState={item.ciState} />}
            {item.unread && (
              <Hint instant className="flex" content={t.inbox.strip.unreadHint}>
                <span
                  className="block size-1.5 shrink-0 rounded-full bg-signal"
                  aria-label={t.inbox.strip.unread}
                />
              </Hint>
            )}
            <span className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* Right-aligned from the date: the most frequent chips sit closest to it. */}
              {hasNewCommitsSinceReview(item) && (
                <Hint
                  instant
                  className="flex"
                  content={t.inbox.strip.newCommitsHint}
                >
                  <span
                    aria-label={t.inbox.strip.newCommits}
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
                  content={t.inbox.strip.slackDiscussionsHint(
                    item.slackDiscussions
                  )}
                >
                  <span
                    aria-label={t.inbox.strip.slackDiscussions(
                      item.slackDiscussions
                    )}
                    className="inline-flex h-4 items-center gap-1 rounded border border-slack/30 bg-slack-surface px-1 font-mono text-[0.65rem] leading-none font-medium text-foreground"
                  >
                    <SlackIcon className="size-3" aria-hidden />
                    {item.slackDiscussions}
                  </span>
                </Hint>
              )}
              <SizeChip item={item} />
              {item.author && (
                <Hint
                  instant
                  className="flex"
                  content={t.inbox.strip.author(item.author)}
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
          {item.kind === "PullRequest" &&
            item.state === "OPEN" &&
            item.readiness && <ReadinessLine readiness={item.readiness} />}
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
              {t.inbox.strip.autoDone} · {item.autoDoneReason}
            </p>
          )}
          {/* The age closes the row on the right, on one line whatever its length. */}
          <div className="flex items-start gap-2 text-[0.7rem] text-muted-foreground">
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
              {reasons.map((reason) => (
                <Hint
                  key={reason.label}
                  content={
                    reason.hint && (
                      <>
                        <span>{reason.hint}</span>
                        <span className="font-mono opacity-70">
                          {reason.weight > 0 ? "+" : "−"}
                          {t.inbox.strip.points(Math.abs(reason.weight))}
                        </span>
                      </>
                    )
                  }
                  className={cn(reason.hint && "cursor-help")}
                >
                  {reason.weight < 0 && (
                    <span aria-label={t.inbox.strip.lowersPriority}>↓ </span>
                  )}
                  {reason.label}
                </Hint>
              ))}
              {item.needsCheck && (
                <Hint
                  content={t.server.priority.needsCheckHint}
                  className="inline-flex cursor-help items-center gap-0.5 text-heat-foreground"
                >
                  <SparklesIcon className="size-3" /> {t.inbox.strip.needsCheck}
                </Hint>
              )}
            </p>
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              {timeAgo(item.updatedAt, language)}
            </span>
          </div>
        </div>
      </button>
    </div>
  )
}
