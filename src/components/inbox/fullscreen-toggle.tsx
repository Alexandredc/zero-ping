import { Maximize2Icon, Minimize2Icon } from "lucide-react"
import { ActionHint } from "@/components/inbox/hint"
import { Button } from "@/components/ui/button"

/** Gives the open PR or issue the whole window, hiding the sidebar and the list. */
export function FullscreenToggle({
  fullscreen,
  onToggle,
}: {
  fullscreen: boolean
  onToggle: () => void
}) {
  return (
    <ActionHint
      content={
        fullscreen
          ? "Revenir à la liste (f ou Échap)"
          : "Plein écran : masque la barre latérale et la liste (f)"
      }
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggle}
        aria-label={fullscreen ? "Quitter le plein écran" : "Plein écran"}
        aria-pressed={fullscreen}
      >
        {fullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
      </Button>
    </ActionHint>
  )
}
