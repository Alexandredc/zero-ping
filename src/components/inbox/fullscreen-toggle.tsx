import { Maximize2Icon, Minimize2Icon } from "lucide-react"
import { ActionHint } from "@/components/inbox/hint"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/hooks/use-i18n"

/** Gives the open PR or issue the whole window, hiding the sidebar and the list. */
export function FullscreenToggle({
  fullscreen,
  onToggle,
}: {
  fullscreen: boolean
  onToggle: () => void
}) {
  const { t } = useI18n()
  return (
    <ActionHint
      content={
        fullscreen ? t.inbox.fullscreen.exitHint : t.inbox.fullscreen.enterHint
      }
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggle}
        aria-label={
          fullscreen ? t.inbox.fullscreen.exit : t.inbox.fullscreen.enter
        }
        aria-pressed={fullscreen}
      >
        {fullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
      </Button>
    </ActionHint>
  )
}
