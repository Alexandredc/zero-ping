import { CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react"
import { Hint } from "./hint"
import { cn } from "@/lib/utils"
import { useI18n } from "@/hooks/use-i18n"

const CI_STATE: Record<
  string,
  { icon: typeof CircleCheckIcon; className: string }
> = {
  SUCCESS: {
    icon: CircleCheckIcon,
    className: "text-diff-add-strong",
  },
  FAILURE: {
    icon: CircleXIcon,
    className: "text-destructive",
  },
  ERROR: {
    icon: CircleXIcon,
    className: "text-destructive",
  },
  PENDING: {
    icon: CircleDashedIcon,
    className: "text-heat",
  },
  EXPECTED: {
    icon: CircleDashedIcon,
    className: "text-heat",
  },
}

/** The checks of a PR's last commit, at a glance next to its number. */
export function CiIcon({ ciState }: { ciState: string | null }) {
  const { t } = useI18n()
  const state = ciState ? CI_STATE[ciState] : null
  if (!ciState || !state) return null
  const Icon = state.icon
  const label = t.pull.checks.ciState[ciState]
  return (
    <Hint instant className="flex" content={label}>
      <Icon
        aria-label={label}
        className={cn("size-3.5 shrink-0", state.className)}
      />
    </Hint>
  )
}
