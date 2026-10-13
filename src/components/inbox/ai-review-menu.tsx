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
import { useI18n } from "@/hooks/use-i18n"

/** Who answers each command, for the menu labels. */
function botName(command: string): string {
  const name = command.match(/^[@/]([\w-]+)/)?.[1] ?? command
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Posts a review command such as `@codex review` as a comment, in one click. */
export function AiReviewMenu({ itemKey }: { itemKey: string }) {
  const { t } = useI18n()
  const { data: settings } = useQuery(settingsQuery())
  const { reply } = useInboxActions()
  const commands = settings?.preferences.reviewCommands ?? []
  if (commands.length === 0) return null

  return (
    <DropdownMenu>
      <ActionHint content={t.detail.aiReview.hint}>
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
          {t.detail.aiReview.button}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
      </ActionHint>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t.detail.aiReview.postOn}</DropdownMenuLabel>
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
