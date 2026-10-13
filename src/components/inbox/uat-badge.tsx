import { useQuery } from "@tanstack/react-query"
import { Hint } from "@/components/inbox/hint"
import { Skeleton } from "@/components/ui/skeleton"
import { uatStatusQuery } from "@/hooks/use-inbox"
import { formatWhen } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { UatStatus } from "@/server/github/uat"

const DOT: Record<UatStatus["state"], string> = {
  merged: "bg-diff-add-strong",
  deployed: "bg-diff-add-strong",
  partial: "bg-heat",
  reverted: "bg-destructive",
  absent: "bg-muted-foreground/50",
}

function describe(status: UatStatus): { label: string; detail: string[] } {
  if (status.state === "merged")
    return {
      label: "Sur UAT",
      detail: ["Le commit de merge est dans l'historique de uat."],
    }
  const when = status.at ? ` le ${formatWhen(new Date(status.at))}` : ""
  const missing = status.missing.length
    ? ["Pas encore sur uat :", ...status.missing.map((m) => `• ${m}`)]
    : []
  const outdated = status.outdated.length
    ? [
        "Réécrits depuis leur déploiement, à redéployer :",
        ...status.outdated.map((m) => `• ${m}`),
      ]
    : []
  switch (status.state) {
    case "deployed":
      return {
        label: status.outdated.length ? "Sur UAT, à redéployer" : "Sur UAT",
        detail: [
          `Tous les commits sont sur uat, déployés${when}.`,
          ...outdated,
        ],
      }
    case "partial":
      return {
        label: `En partie sur UAT · ${status.shipped}/${status.total}`,
        detail: [`Dernier déploiement${when}.`, ...missing, ...outdated],
      }
    case "reverted":
      return {
        label: "Retirée d'UAT",
        detail: [`Déployée puis revertée sur uat${when}.`],
      }
    case "absent":
      return {
        label: "Pas sur UAT",
        detail: ["Aucun commit de la PR dans les derniers commits de uat."],
      }
  }
}

/** Whether the PR's commits run on uat, matched by their subject. */
export function UatBadge({ itemKey }: { itemKey: string }) {
  const { data, isPending } = useQuery(uatStatusQuery(itemKey))
  if (isPending) return <Skeleton className="h-6 w-24" />
  if (!data) return null
  const { label, detail } = describe(data)
  const stale = data.state !== "merged" && data.outdated.length > 0
  return (
    <Hint
      className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-medium"
      content={
        <>
          {detail.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
          <span className="text-muted-foreground">
            Comparé aux titres des commits, qui restent les mêmes quand un
            cherry-pick règle un conflit.
          </span>
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
