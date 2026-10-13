import { Hint } from "./hint"
import { URGENCY_LEVELS } from "@/server/inbox/priority"
import { cn } from "@/lib/utils"
import { useI18n } from "@/hooks/use-i18n"
import type { Messages } from "@/lib/i18n/messages"

/** Jev's urgency on the 0–100 scale of the priority gauge: 3 levels above « peut attendre ». */
export function jevScore(urgency: number): number {
  return Math.round((urgency / (URGENCY_LEVELS.length - 1)) * 100)
}

/** Jev's urgency level in words, lowercased to read in a sentence. */
export function jevUrgencyLabel(urgency: number, t: Messages): string {
  const levels = t.pull.jev.urgencyLevels
  const index = Math.min(Math.max(Math.round(urgency), 0), levels.length - 1)
  return levels[index].toLowerCase()
}

/**
 * The priority gauge of the inbox strips, fed by Jev's urgency alone: used
 * where no inbox rule applies, for teammates' PRs and sprint tickets.
 */
export function JevGauge({ urgency }: { urgency: number | null }) {
  const { t } = useI18n()
  const score = urgency === null ? null : jevScore(urgency)
  const level = Math.max(0.08, (score ?? 0) / 100)
  return (
    <Hint
      side="right"
      className="relative flex w-9 shrink-0 flex-col items-center gap-1 pt-0.5"
      content={
        urgency === null ? (
          <>
            <span className="font-medium">{t.pull.jev.notRated}</span>
            <span className="opacity-70">{t.pull.jev.notRatedHint}</span>
          </>
        ) : (
          <>
            <span className="font-medium">
              {t.pull.jev.urgency(jevUrgencyLabel(urgency, t), score ?? 0)}
            </span>
            <span className="opacity-70">{t.pull.jev.urgencyHint}</span>
          </>
        )
      }
    >
      <span
        className={cn(
          "font-mono text-xs font-medium tabular-nums",
          score !== null && score >= 60
            ? "text-heat-foreground"
            : "text-muted-foreground"
        )}
      >
        {score ?? "–"}
      </span>
      <div className="relative w-1 flex-1 overflow-hidden rounded-full bg-strip">
        {score !== null && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500",
              score >= 60 ? "bg-heat" : "bg-signal/70"
            )}
            style={{ height: `${level * 100}%` }}
          />
        )}
      </div>
    </Hint>
  )
}
