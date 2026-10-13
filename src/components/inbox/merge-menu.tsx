import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { ChevronDownIcon, GitMergeIcon } from "lucide-react"
import { ActionHint } from "./hint"
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
import { useI18n } from "@/hooks/use-i18n"

/** Merges the viewer's PR from the inbox; the merge state is read when the menu opens. */
export function MergeMenu({
  itemKey,
  approved,
}: {
  itemKey: string
  approved: boolean
}) {
  const { t } = useI18n()
  const copy = t.detail.merge
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
      <ActionHint content={copy.hint}>
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
          {copy.button}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
      </ActionHint>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {!info
              ? copy.checking
              : info.canMerge
                ? copy.mergeWith
                : info.blockedReason}
          </DropdownMenuLabel>
          {!info && isFetching && (
            <DropdownMenuItem disabled>
              <Spinner /> {copy.state}
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
              {copy.methods[method]}
              {method === info.defaultMethod && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {copy.default}
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
                  {copy.deleteBranch}{" "}
                  <span className="truncate font-mono text-xs">
                    {info.headRef}
                  </span>
                </DropdownMenuCheckboxItem>
              ) : (
                <DropdownMenuLabel className="font-normal">
                  {info.isCrossRepository ? copy.forkBranch : copy.autoDelete}
                </DropdownMenuLabel>
              )}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
