import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon, RotateCwIcon, XCircleIcon } from "lucide-react"
import { checksQuery, useRerunChecks } from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

/** The checks failing on the PR's head, with their logs and a re-run of the failed jobs. */
export function FailedChecks({ itemKey }: { itemKey: string }) {
  const { data, isPending, error } = useQuery(checksQuery(itemKey))
  const rerun = useRerunChecks(itemKey)

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <header className="flex items-center gap-2">
        <XCircleIcon className="size-4 text-destructive" />
        <h3 className="text-sm font-semibold">CI en échec</h3>
        {data && data.rerunnableRuns.length > 0 && (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => rerun.mutate()}
            disabled={rerun.isPending || rerun.isSuccess}
          >
            {rerun.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RotateCwIcon data-icon="inline-start" />
            )}
            {rerun.isSuccess ? "Relancés" : "Relancer les jobs en échec"}
          </Button>
        )}
      </header>
      {isPending && <Skeleton className="h-8 w-full" />}
      {error && (
        <p className="text-xs text-muted-foreground">
          Checks indisponibles : {error.message}
        </p>
      )}
      {data && data.failed.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Plus aucun check en échec sur le dernier commit : la CI tourne
          peut-être encore.
        </p>
      )}
      {data && data.failed.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {data.failed.map((check) => (
            <li key={`${check.name}:${check.url}`} className="flex gap-2">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{check.name}</span>
                {check.summary && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {check.summary}
                  </span>
                )}
              </span>
              {check.url && (
                <a
                  href={check.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-primary hover:underline"
                >
                  Voir le log
                  <ExternalLinkIcon className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {data && data.failed.length > 0 && data.rerunnableRuns.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Ces checks viennent d'une CI externe : relance-les depuis son
          interface.
        </p>
      )}
    </section>
  )
}
