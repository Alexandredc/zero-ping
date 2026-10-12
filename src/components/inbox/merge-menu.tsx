import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { ChevronDownIcon, GitMergeIcon } from "lucide-react"
import { ActionHint } from "./hint"
import type { MergeMethod } from "@/server/github/merge"
import { mergeInfoQuery, useMerge } from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"

const METHOD_LABEL: Record<MergeMethod, string> = {
  SQUASH: "Squash and merge",
  MERGE: "Merge commit",
  REBASE: "Rebase and merge",
}

/** Merges the viewer's PR from the inbox; the merge state is read when the menu opens. */
export function MergeMenu({
  itemKey,
  approved,
}: {
  itemKey: string
  approved: boolean
}) {
  const [open, setOpen] = useState(false)
  const [deleteBranch, setDeleteBranch] = useState(true)
  const { data: info, isFetching } = useQuery({
    ...mergeInfoQuery(itemKey),
    enabled: open,
  })
  const merge = useMerge(itemKey)
  const canDelete = info && !info.autoDeletesBranch && !info.isCrossRepository

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <ActionHint content="Merge la PR sur GitHub, avec la méthode choisie, et supprime sa branche si tu le veux.">
        <DropdownMenuTrigger
          render={
            <Button
              variant={approved ? "default" : "outline"}
              size="sm"
              disabled={merge.isPending}
            />
          }
        >
          {merge.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <GitMergeIcon data-icon="inline-start" />
          )}
          Merger
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
      </ActionHint>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {!info
              ? "Vérification de la PR…"
              : info.canMerge
                ? "Merger avec…"
                : info.blockedReason}
          </DropdownMenuLabel>
          {!info && isFetching && (
            <DropdownMenuItem disabled>
              <Spinner /> État du merge sur GitHub
            </DropdownMenuItem>
          )}
          {info?.methods.map((method) => (
            <DropdownMenuItem
              key={method}
              disabled={!info.canMerge}
              onClick={() =>
                merge.mutate({
                  method,
                  deleteBranch: Boolean(canDelete && deleteBranch),
                })
              }
            >
              {METHOD_LABEL[method]}
              {method === info.defaultMethod && (
                <span className="ml-auto text-xs text-muted-foreground">
                  par défaut
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {info && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {canDelete ? (
                <DropdownMenuCheckboxItem
                  checked={deleteBranch}
                  onCheckedChange={setDeleteBranch}
                  closeOnClick={false}
                >
                  Supprimer la branche{" "}
                  <span className="truncate font-mono text-xs">
                    {info.headRef}
                  </span>
                </DropdownMenuCheckboxItem>
              ) : (
                <DropdownMenuLabel className="font-normal">
                  {info.isCrossRepository
                    ? "Branche dans un fork : elle reste en place."
                    : "GitHub supprime la branche après le merge."}
                </DropdownMenuLabel>
              )}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
