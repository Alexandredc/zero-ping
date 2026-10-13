import { useQuery } from "@tanstack/react-query"
import { CheckCircle2Icon, CircleDashedIcon, XCircleIcon } from "lucide-react"
import { Hint } from "@/components/inbox/hint"
import { Skeleton } from "@/components/ui/skeleton"
import { checksQuery } from "@/hooks/use-inbox"
import { cn } from "@/lib/utils"
import type { ChecksSummary } from "@/server/github/checks"

type Verdict = "passed" | "failed" | "pending" | "none"

function verdictOf(summary: ChecksSummary): Verdict {
  if (summary.failed > 0) return "failed"
  if (summary.pending > 0) return "pending"
  return summary.passed + summary.skipped > 0 ? "passed" : "none"
}

const STYLE: Record<Verdict, { bar: string; text: string }> = {
  passed: { bar: "bg-diff-add-strong", text: "text-diff-add-strong" },
  failed: { bar: "bg-destructive", text: "text-destructive" },
  pending: { bar: "bg-heat", text: "text-heat" },
  none: { bar: "bg-border", text: "text-muted-foreground" },
}

function label(verdict: Verdict, summary: ChecksSummary) {
  const total =
    summary.passed + summary.failed + summary.pending + summary.skipped
  switch (verdict) {
    case "passed":
      return `Tous les checks passent · ${summary.passed}/${total - summary.skipped}`
    case "failed":
      return `${summary.failed} check${summary.failed > 1 ? "s" : ""} en échec`
    case "pending":
      return `Checks en cours · ${summary.pending} sur ${total}`
    case "none":
      return "Aucun check"
  }
}

/** The colored line at the top of a PR's panel: are all of GitHub's checks green? */
export function ChecksBar({ itemKey }: { itemKey: string }) {
  const { data } = useQuery(checksQuery(itemKey))
  const verdict = data ? verdictOf(data.summary) : null
  return (
    <div
      aria-hidden
      className={cn(
        "h-1 w-full shrink-0 transition-colors",
        verdict ? STYLE[verdict].bar : "animate-pulse bg-muted"
      )}
    />
  )
}

/** What the checks say, with the ones still running on hover. */
export function ChecksIndicator({ itemKey }: { itemKey: string }) {
  const { data, isPending, error } = useQuery({
    ...checksQuery(itemKey),
    // Running checks finish on their own: look again soon until they do.
    refetchInterval: (query) =>
      query.state.data && query.state.data.summary.pending > 0
        ? 20_000
        : 60_000,
  })
  if (isPending) return <Skeleton className="h-4 w-36" />
  if (error) return null
  const verdict = verdictOf(data.summary)
  const Icon =
    verdict === "passed"
      ? CheckCircle2Icon
      : verdict === "failed"
        ? XCircleIcon
        : CircleDashedIcon
  const { summary } = data
  return (
    <Hint
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        STYLE[verdict].text
      )}
      content={
        <>
          <span>
            Sur le dernier commit : {summary.passed} réussi
            {summary.passed > 1 ? "s" : ""}, {summary.failed} en échec,{" "}
            {summary.pending} en cours, {summary.skipped} ignoré
            {summary.skipped > 1 ? "s" : ""}.
          </span>
          {data.failed.length > 0 && (
            <span>
              En échec : {data.failed.map((check) => check.name).join(", ")}
            </span>
          )}
          {summary.running.length > 0 && (
            <span>En cours : {summary.running.join(", ")}</span>
          )}
        </>
      }
    >
      <Icon
        className={cn(
          "size-3.5",
          verdict === "pending" && "animate-spin [animation-duration:3s]"
        )}
      />
      {label(verdict, summary)}
    </Hint>
  )
}
