import { Hint } from "./hint"
import { URGENCY_LEVELS } from "@/server/inbox/priority"
import { cn } from "@/lib/utils"

/** Jev's urgency on the 0–100 scale of the priority gauge: 3 levels above « peut attendre ». */
export function jevScore(urgency: number): number {
  return Math.round((urgency / (URGENCY_LEVELS.length - 1)) * 100)
}

/**
 * The priority gauge of the inbox strips, fed by Jev's urgency alone: used
 * where no inbox rule applies, for teammates' PRs and sprint tickets.
 */
export function JevGauge({ urgency }: { urgency: number | null }) {
  const score = urgency === null ? null : jevScore(urgency)
  const level = Math.max(0.08, (score ?? 0) / 100)
  return (
    <Hint
      side="right"
      className="relative flex w-9 shrink-0 flex-col items-center gap-1 pt-0.5"
      content={
        urgency === null ? (
          <>
            <span className="font-medium">Pas encore évaluée par Jev</span>
            <span className="opacity-70">
              Jev l'évalue en arrière-plan ; elle sera classée au prochain
              rafraîchissement. Une réponse trop peu sûre n'est pas comptée.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">
              Urgence Jev : {URGENCY_LEVELS[Math.round(urgency)].toLowerCase()}{" "}
              ({score} sur 100)
            </span>
            <span className="opacity-70">
              Estimée d'après le titre, la description, les labels et les
              derniers commentaires. Plus le score est haut, plus c'est à
              traiter tôt.
            </span>
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
