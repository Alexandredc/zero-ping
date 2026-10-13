import { useQuery } from "@tanstack/react-query"
import { Hint } from "@/components/inbox/hint"
import { Skeleton } from "@/components/ui/skeleton"
import { uatStatusQuery } from "@/hooks/use-inbox"
import { formatWhen } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useI18n } from "@/hooks/use-i18n"
import type { Language } from "@/lib/i18n/core"
import type { Messages } from "@/lib/i18n/messages"
import type { UatStatus } from "@/server/github/uat"

const DOT: Record<UatStatus["state"], string> = {
  merged: "bg-diff-add-strong",
  deployed: "bg-diff-add-strong",
  partial: "bg-heat",
  reverted: "bg-destructive",
  absent: "bg-muted-foreground/50",
}

/** The badge label and its tooltip lines, in the viewer's language. */
export function describeUat(
  status: UatStatus,
  t: Messages,
  language: Language
): { label: string; detail: string[] } {
  const copy = t.detail.uat
  if (status.state === "merged")
    return { label: copy.on, detail: [copy.mergeCommitOnUat] }
  const when = status.at
    ? copy.when(formatWhen(new Date(status.at), language))
    : ""
  const missing = status.missing.length
    ? [copy.missing, ...status.missing.map((m) => `• ${m}`)]
    : []
  const outdated = status.outdated.length
    ? [copy.outdated, ...status.outdated.map((m) => `• ${m}`)]
    : []
  switch (status.state) {
    case "deployed":
      return {
        label: status.outdated.length ? copy.onToRedeploy : copy.on,
        detail: [copy.allDeployed(when), ...outdated],
      }
    case "partial":
      return {
        label: copy.partial(status.shipped, status.total),
        detail: [copy.lastDeploy(when), ...missing, ...outdated],
      }
    case "reverted":
      return { label: copy.reverted, detail: [copy.revertedDetail(when)] }
    case "absent":
      return { label: copy.absent, detail: [copy.absentDetail] }
  }
}

/** Whether the PR's commits run on uat, matched by their subject. */
export function UatBadge({ itemKey }: { itemKey: string }) {
  const { t, language } = useI18n()
  const { data, isPending } = useQuery(uatStatusQuery(itemKey))
  if (isPending) return <Skeleton className="h-6 w-24" />
  if (!data) return null
  const { label, detail } = describeUat(data, t, language)
  const stale = data.state !== "merged" && data.outdated.length > 0
  return (
    <Hint
      className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium"
      content={
        <>
          {detail.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
          <span className="text-muted-foreground">{t.detail.uat.matching}</span>
        </>
      }
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          stale ? "bg-heat" : DOT[data.state]
        )}
      />
      {label}
    </Hint>
  )
}
