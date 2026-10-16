import { CircleDashedIcon, GitMergeIcon, HourglassIcon } from "lucide-react"
import { Hint } from "./hint"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useI18n } from "@/hooks/use-i18n"
import { gapLabel, readinessText } from "@/lib/readiness"
import { cn } from "@/lib/utils"
import type { Readiness } from "@/server/readiness/rules"

function ReadinessIcon({
  readiness,
  className,
}: {
  readiness: Readiness
  className?: string
}) {
  if (readiness.status === "ready")
    return <GitMergeIcon className={className} />
  if (readiness.status === "computing")
    return <CircleDashedIcon className={className} />
  return <HourglassIcon className={className} />
}

function hintOf(readiness: Readiness, t: ReturnType<typeof useI18n>["t"]) {
  const r = t.pull.readiness
  if (readiness.status === "ready") return r.readyHint
  if (readiness.status === "computing") return r.computingHint
  return readiness.gaps.some((gap) => gap.kind === "wait") ? r.waitHint : null
}

/** One line in the list: « Prête à merger » or « Presque : à rebaser… ». */
export function ReadinessLine({ readiness }: { readiness: Readiness }) {
  const { t } = useI18n()
  const hint = hintOf(readiness, t)
  return (
    <Hint
      content={hint}
      className={cn(
        "flex min-w-0 items-center gap-1 text-xs",
        readiness.status === "ready"
          ? "font-medium text-diff-add-strong"
          : "text-muted-foreground",
        hint && "cursor-help"
      )}
    >
      <ReadinessIcon readiness={readiness} className="size-3 shrink-0" />
      <span className="truncate">{readinessText(readiness, t)}</span>
    </Hint>
  )
}

/** The detail panel's verdict, with each missing thing on its own line. */
export function ReadinessCard({ readiness }: { readiness: Readiness }) {
  const { t } = useI18n()
  const r = t.pull.readiness
  const hint = hintOf(readiness, t)
  return (
    <Alert
      className={cn(
        readiness.status === "ready" &&
          "text-diff-add-strong *:data-[slot=alert-description]:text-muted-foreground"
      )}
    >
      <ReadinessIcon readiness={readiness} />
      <AlertTitle>
        {readiness.status === "ready"
          ? r.ready
          : readiness.status === "computing"
            ? r.computing
            : r.almost}
      </AlertTitle>
      <AlertDescription>
        {readiness.status === "almost" && (
          <ul className="list-disc pl-4 text-foreground">
            {readiness.gaps.map((gap) => (
              <li key={gap.kind}>{gapLabel(gap, t)}</li>
            ))}
          </ul>
        )}
        {hint && <p>{hint}</p>}
      </AlertDescription>
    </Alert>
  )
}
