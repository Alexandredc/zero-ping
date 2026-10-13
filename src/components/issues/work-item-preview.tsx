import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { ChevronDownIcon, FileTextIcon, XIcon } from "lucide-react"
import { GitHubIcon } from "@/components/brand-icons"
import { MentionTextarea } from "@/components/inbox/mention-textarea"
import { SlackDiscussions } from "@/components/inbox/slack-discussions"
import { ItemInsights } from "@/components/inbox/item-insights"
import { GitHubConversation } from "@/components/inbox/github-conversation"
import type { ReplyTarget } from "@/components/inbox/github-conversation"
import { ActionHint, Hint } from "@/components/inbox/hint"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import {
  useInboxActions,
  useSetWorkItemStatus,
  workConversationQuery,
} from "@/hooks/use-inbox"
import { avatarUrl } from "@/lib/format"
import type { SprintStatus, WorkItem } from "@/server/issues/sprint"

function StatusDot({ color }: { color: string | undefined }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-muted-foreground"
      style={color ? { backgroundColor: color } : undefined}
    />
  )
}

/** The board column of the item; on the sprint project's board, a menu moves it. */
function StatusMenu({
  item,
  statuses,
  board,
}: {
  item: WorkItem
  statuses: SprintStatus[]
  board: { projectId: string; fieldId: string } | null
}) {
  const move = useSetWorkItemStatus()
  const color = statuses.find((s) => s.name === item.status)?.color
  const canMove = Boolean(board && item.projectItemId && statuses.length > 0)
  const label = item.status ?? "Sans statut"
  if (!canMove)
    return item.status ? (
      <span className="inline-flex items-center gap-1.5 rounded-md border px-1.5 text-xs leading-5">
        <StatusDot color={color} />
        {label}
      </span>
    ) : null
  return (
    <DropdownMenu>
      <ActionHint content="Change la colonne du ticket sur le board GitHub du projet.">
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="xs" disabled={move.isPending} />
          }
        >
          {move.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <StatusDot color={color} />
          )}
          {label}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
      </ActionHint>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Déplacer dans…</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={item.status ?? ""}
            onValueChange={(value) => {
              const status = statuses.find((s) => s.name === value)
              if (!status || !board || !item.projectItemId) return
              move.mutate({
                projectId: board.projectId,
                fieldId: board.fieldId,
                itemId: item.projectItemId,
                optionId: status.id,
                status: status.name,
              })
            }}
          >
            {statuses.map((status) => (
              <DropdownMenuRadioItem key={status.id} value={status.name}>
                <StatusDot color={status.color} />
                {status.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The issue or PR picked in « Mes issues »: its board facts, its conversation and a reply box. */
export function WorkItemPreview({
  item,
  statuses,
  board,
  composerRef,
  onClose,
}: {
  item: WorkItem
  statuses: SprintStatus[]
  board: { projectId: string; fieldId: string } | null
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onClose: () => void
}) {
  const kind = item.kind === "pull" ? "PullRequest" : "Issue"
  const readable = item.kind !== "draft"
  const { data, isPending, error } = useQuery({
    ...workConversationQuery(item.key, kind),
    enabled: readable,
  })
  const queryClient = useQueryClient()
  const actions = useInboxActions()
  const [body, setBody] = useState("")
  const [target, setTarget] = useState<ReplyTarget>({ type: "conversation" })

  useEffect(() => {
    setBody("")
    setTarget({ type: "conversation" })
  }, [item.key])

  const send = () => {
    if (!body.trim() || actions.reply.isPending) return
    actions.reply.mutate(
      {
        key: item.key,
        body,
        target:
          target.type === "thread"
            ? { type: "thread", commentDatabaseId: target.commentDatabaseId }
            : { type: "conversation" },
      },
      {
        onSuccess: () => {
          setBody("")
          void queryClient.invalidateQueries({
            queryKey: ["work-conversation", item.key],
          })
        },
      }
    )
  }

  return (
    <section
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
      aria-label="Aperçu"
    >
      <header className="flex flex-col gap-3 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-mono text-xs text-muted-foreground">
              {item.repo
                ? `${item.repo}#${item.number}`
                : "Brouillon du projet"}
            </p>
            <h2 className="font-heading text-xl leading-tight font-semibold tracking-tight">
              {item.title}
            </h2>
          </div>
          <ActionHint content="Fermer l'aperçu (Échap)">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Fermer"
            >
              <XIcon />
            </Button>
          </ActionHint>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusMenu item={item} statuses={statuses} board={board} />
          {item.sprint && (
            <span className="rounded-md bg-muted px-1.5 text-xs leading-5 font-medium">
              {item.sprint}
            </span>
          )}
          {item.labels.map((label) => (
            <span
              key={label.name}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 text-[0.7rem] leading-5"
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ backgroundColor: `#${label.color}` }}
              />
              {label.name}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {item.assignees.length === 0
              ? "Non assignée"
              : item.assignees.map((login) => (
                  <Hint
                    key={login}
                    instant
                    className="flex"
                    content={`@${login}`}
                  >
                    <Avatar className="size-5">
                      <AvatarImage src={avatarUrl(login)} alt="" />
                      <AvatarFallback className="text-[0.5rem]">
                        {login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Hint>
                ))}
          </span>
          {item.url && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              nativeButton={false}
              render={<a href={item.url} target="_blank" rel="noreferrer" />}
            >
              <GitHubIcon data-icon="inline-start" />
              Ouvrir
              <Kbd>o</Kbd>
            </Button>
          )}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-5 py-4">
          {!readable && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileTextIcon className="size-4" />
              Brouillon du board, sans conversation : ouvre le projet sur GitHub
              pour le détailler.
            </p>
          )}
          {readable && item.url && (
            <ItemInsights
              itemKey={item.key}
              kind={kind === "PullRequest" ? "PR" : "issue"}
              subject={{ kind, title: item.title, url: item.url }}
            />
          )}
          {readable && item.url && (
            <SlackDiscussions
              itemKey={item.key}
              subject={{ kind, title: item.title, url: item.url }}
            />
          )}
          {readable && (
            <GitHubConversation
              conversation={data}
              isPending={isPending}
              error={error}
              onReplyInThread={setTarget}
            />
          )}
        </div>
      </ScrollArea>

      {readable && (
        <footer className="flex flex-col gap-2 border-t bg-card px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitHubIcon className="size-3.5 text-foreground" />
            {target.type === "thread" ? (
              <>
                <span className="truncate">
                  Réponse dans le fil GitHub{" "}
                  <span className="font-mono">{target.path}</span>
                </span>
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => setTarget({ type: "conversation" })}
                >
                  Répondre à la conversation
                </Button>
              </>
            ) : (
              <span>Commentaire sur la conversation GitHub</span>
            )}
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              <Kbd>r</Kbd> pour écrire, <Kbd>⌘</Kbd>
              <Kbd>Entrée</Kbd> pour envoyer
            </span>
          </div>
          <MentionTextarea
            ref={composerRef}
            repo={item.repo}
            value={body}
            onValueChange={setBody}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                send()
              }
              if (event.key === "Escape") event.currentTarget.blur()
            }}
            placeholder="Écris ton commentaire en Markdown…"
            className="max-h-60 min-h-16"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={send}
              disabled={!body.trim() || actions.reply.isPending}
            >
              {actions.reply.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GitHubIcon data-icon="inline-start" />
              )}
              Envoyer sur GitHub
            </Button>
          </div>
        </footer>
      )}
    </section>
  )
}
