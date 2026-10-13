import { useQuery } from "@tanstack/react-query"
import { ChevronDownIcon } from "lucide-react"
import { ActionHint } from "@/components/inbox/hint"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { projectFieldsQuery, useSetProjectField } from "@/hooks/use-inbox"
import type { SprintStatus } from "@/server/issues/sprint"

function OptionDot({ color }: { color: string | undefined }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-muted-foreground"
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

/** One single-select field of the card, as a menu that sets it on GitHub. */
function FieldMenu({
  label,
  value,
  empty,
  options,
  hint,
  pending,
  onChange,
}: {
  label: string
  value: string | null
  empty: string
  options: SprintStatus[]
  hint: string
  pending: boolean
  onChange: (option: SprintStatus) => void
}) {
  const color = options.find((option) => option.name === value)?.color
  return (
    <DropdownMenu>
      <ActionHint content={hint}>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="xs" disabled={pending} />}
        >
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <OptionDot color={color} />
          )}
          <span className="text-muted-foreground">{label}</span>
          {value ?? empty}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
      </ActionHint>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value ?? ""}
            onValueChange={(name) => {
              const option = options.find((o) => o.name === name)
              if (option) onChange(option)
            }}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.name}>
                <OptionDot color={option.color} />
                {option.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The status and priority of the item's card on the sprint project, editable in place. */
export function ProjectFields({ itemKey }: { itemKey: string }) {
  const { data, isPending } = useQuery(projectFieldsQuery(itemKey))
  const set = useSetProjectField(itemKey)
  if (isPending)
    return (
      <div className="flex gap-1.5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
    )
  if (!data) return null
  const where = data.via
    ? `la carte de l'issue #${data.via.number} que cette PR ferme, sur le projet « ${data.projectTitle} »`
    : `la carte du projet « ${data.projectTitle} »`
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {data.statusField && (
        <FieldMenu
          label="Statut"
          value={data.status}
          empty="Sans statut"
          options={data.statusField.options}
          hint={`Colonne de ${where}. Choisir une valeur la change sur GitHub.`}
          pending={set.isPending && set.variables.field === "status"}
          onChange={(option) =>
            data.statusField &&
            set.mutate({
              projectId: data.projectId,
              itemId: data.itemId,
              fieldId: data.statusField.id,
              optionId: option.id,
              field: "status",
              value: option.name,
            })
          }
        />
      )}
      {data.priorityField && (
        <FieldMenu
          label="Priorité"
          value={data.priority}
          empty="Aucune"
          options={data.priorityField.options}
          hint={`Priorité de ${where}. Choisir une valeur la change sur GitHub.`}
          pending={set.isPending && set.variables.field === "priority"}
          onChange={(option) =>
            data.priorityField &&
            set.mutate({
              projectId: data.projectId,
              itemId: data.itemId,
              fieldId: data.priorityField.id,
              optionId: option.id,
              field: "priority",
              value: option.name,
            })
          }
        />
      )}
      {data.via && (
        <span className="text-xs text-muted-foreground">
          via #{data.via.number}
        </span>
      )}
    </div>
  )
}
