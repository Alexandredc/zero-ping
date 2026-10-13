import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { SparklesIcon, UsersIcon, UserRoundPlusIcon } from "lucide-react"
import { ActionHint } from "./hint"
import type { ReviewerCandidate } from "@/server/github/reviewers"
import { reviewerChanges } from "@/server/github/reviewers"
import { reviewerOptionsQuery, useSetReviewers } from "@/hooks/use-inbox"
import { avatarUrl } from "@/lib/format"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"

const REVIEW_STATE: Record<string, string> = {
  APPROVED: "a approuvé",
  CHANGES_REQUESTED: "a demandé des changements",
  COMMENTED: "a commenté",
  DISMISSED: "review écartée",
}

function CandidateItem({
  candidate,
  checked,
  onToggle,
}: {
  candidate: ReviewerCandidate
  checked: boolean
  onToggle: () => void
}) {
  return (
    <CommandItem
      value={candidate.id}
      keywords={[candidate.name ?? "", candidate.label]}
      data-checked={checked}
      onSelect={onToggle}
    >
      {candidate.kind === "team" ? (
        <UsersIcon className="text-muted-foreground" />
      ) : (
        <Avatar className="size-5">
          <AvatarImage src={avatarUrl(candidate.id)} alt="" />
          <AvatarFallback className="text-[0.5rem]">
            {candidate.id.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{candidate.label}</span>
        {(candidate.name || candidate.reviewState) && (
          <span className="truncate text-xs text-muted-foreground">
            {[
              candidate.name,
              candidate.reviewState && REVIEW_STATE[candidate.reviewState],
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </span>
    </CommandItem>
  )
}

/**
 * Chooses who reviews a PR: GitHub's suggestions first, then the people and
 * teams who can review the repo. Saving requests the added ones and withdraws
 * the removed ones.
 */
export function ReviewersMenu({
  itemKey,
  size = "sm",
  variant = "outline",
}: {
  itemKey: string
  size?: "sm" | "xs"
  variant?: "outline" | "default" | "ghost"
}) {
  const [open, setOpen] = useState(false)
  // Null until the viewer changes something: the PR's current reviewers show meanwhile.
  const [draft, setDraft] = useState<string[] | null>(null)
  const { data, isPending } = useQuery({
    ...reviewerOptionsQuery(itemKey),
    enabled: open,
  })
  const save = useSetReviewers(itemKey)
  const requested = data?.requested ?? []
  const selected = draft ?? requested
  const changes = reviewerChanges(requested, selected)
  const changed = changes.add.length + changes.remove.length > 0

  const isSelected = (id: string) =>
    selected.some((other) => other.toLowerCase() === id.toLowerCase())
  const toggle = (id: string) =>
    setDraft(
      isSelected(id)
        ? selected.filter((other) => other.toLowerCase() !== id.toLowerCase())
        : [...selected, id]
    )

  const candidates = data?.candidates ?? []
  const groups = [
    {
      heading: "Suggérés par GitHub",
      items: candidates.filter((c) => c.suggested),
    },
    {
      heading: "Personnes",
      items: candidates.filter((c) => c.kind === "user" && !c.suggested),
    },
    { heading: "Équipes", items: candidates.filter((c) => c.kind === "team") },
  ].filter((group) => group.items.length > 0)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setDraft(null)
      }}
    >
      <ActionHint content="Choisis qui doit reviewer la PR : GitHub leur envoie la demande, et retire celle des reviewers que tu décoches.">
        <PopoverTrigger
          render={
            <Button variant={variant} size={size} disabled={save.isPending} />
          }
        >
          {save.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <UserRoundPlusIcon data-icon="inline-start" />
          )}
          Reviewers
        </PopoverTrigger>
      </ActionHint>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Chercher une personne ou une équipe…" />
          <CommandList>
            <CommandEmpty>
              {isPending ? (
                <span className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Spinner /> Chargement des reviewers…
                </span>
              ) : (
                "Personne ne correspond."
              )}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup
                key={group.heading}
                heading={
                  group.heading === "Suggérés par GitHub" ? (
                    <span className="flex items-center gap-1">
                      <SparklesIcon className="size-3" />
                      {group.heading}
                    </span>
                  ) : (
                    group.heading
                  )
                }
              >
                {group.items.map((candidate) => (
                  <CandidateItem
                    key={candidate.id}
                    candidate={candidate}
                    checked={isSelected(candidate.id)}
                    onToggle={() => toggle(candidate.id)}
                  />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <span className="text-xs text-muted-foreground">
              {changed
                ? [
                    changes.add.length > 0 && `+${changes.add.length}`,
                    changes.remove.length > 0 && `−${changes.remove.length}`,
                  ]
                    .filter(Boolean)
                    .join(" ")
                : `${selected.length} reviewer${selected.length > 1 ? "s" : ""}`}
            </span>
            <Button
              size="sm"
              disabled={!changed || save.isPending}
              onClick={() =>
                save.mutate(selected, {
                  onSuccess: () => {
                    setOpen(false)
                    setDraft(null)
                  },
                })
              }
            >
              {save.isPending && <Spinner data-icon="inline-start" />}
              Enregistrer
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
