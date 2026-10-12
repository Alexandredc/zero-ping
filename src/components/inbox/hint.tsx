import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Explains a label on hover. Renders a span trigger so it can sit inside the
 * clickable list rows without nesting buttons.
 */
export function Hint({
  content,
  children,
  className,
  side,
  instant,
}: {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
  side?: "top" | "right" | "bottom" | "left"
  /** Opens without the hover delay, for small icons read at a glance. */
  instant?: boolean
}) {
  if (!content) return <span className={className}>{children}</span>
  return (
    <Tooltip>
      <TooltipTrigger
        delay={instant ? 0 : undefined}
        render={<span className={className} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="flex-col items-start text-left">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Explains an action on hover and keyboard focus. The trigger element is
 * rendered as is, so it can itself be a menu trigger or a link button.
 */
export function ActionHint({
  content,
  children,
  side = "bottom",
}: {
  content: React.ReactNode
  children: React.ReactElement
  side?: "top" | "right" | "bottom" | "left"
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={side}
        className="max-w-72 flex-col items-start text-left"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
