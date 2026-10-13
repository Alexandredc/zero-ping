import { CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react"
import { Hint } from "./hint"
import { cn } from "@/lib/utils"

const CI_STATE: Record<
  string,
  { icon: typeof CircleCheckIcon; className: string; label: string }
> = {
  SUCCESS: {
    icon: CircleCheckIcon,
    className: "text-diff-add-strong",
    label: "Tous les checks passent",
  },
  FAILURE: {
    icon: CircleXIcon,
    className: "text-destructive",
    label: "Des checks sont en échec",
  },
  ERROR: {
    icon: CircleXIcon,
    className: "text-destructive",
    label: "Des checks sont en erreur",
  },
  PENDING: {
    icon: CircleDashedIcon,
    className: "text-heat",
    label: "Checks en cours",
  },
  EXPECTED: {
    icon: CircleDashedIcon,
    className: "text-heat",
    label: "Checks attendus",
  },
}

/** The checks of a PR's last commit, at a glance next to its number. */
export function CiIcon({ ciState }: { ciState: string | null }) {
  const state = ciState ? CI_STATE[ciState] : null
  if (!state) return null
  const Icon = state.icon
  return (
    <Hint instant className="flex" content={state.label}>
      <Icon
        aria-label={state.label}
        className={cn("size-3.5 shrink-0", state.className)}
      />
    </Hint>
  )
}
