import { useQuery } from "@tanstack/react-query"
import { BotIcon, ChevronDownIcon } from "lucide-react"
import { ActionHint } from "./hint"
import { settingsQuery, useInboxActions } from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"

/** Who answers each command, for the menu labels. */
function botName(command: string): string {
  const name = command.match(/^[@/]([\w-]+)/)?.[1] ?? command
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Posts a review command such as `@codex review` as a comment, in one click. */
export function AiReviewMenu({ itemKey }: { itemKey: string }) {
  const { data: settings } = useQuery(settingsQuery())
  const { reply } = useInboxActions()
  const commands = settings?.preferences.reviewCommands ?? []
  if (commands.length === 0) return null

  return (
    <DropdownMenu>
      <ActionHint content="Poste en un clic un commentaire qui demande une review à un bot IA (Codex, Claude, Gemini…). Les commandes se règlent dans Réglages > Agent IA.">
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={reply.isPending} />
          }
        >
          {reply.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <BotIcon data-icon="inline-start" />
          )}
          Review IA
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
      </ActionHint>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Poster sur la PR…</DropdownMenuLabel>
          {commands.map((command) => (
            <DropdownMenuItem
              key={command}
              onClick={() =>
                reply.mutate({
                  key: itemKey,
                  body: command,
                  target: { type: "conversation" },
                })
              }
            >
              {botName(command)}
              <code className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {command}
              </code>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
