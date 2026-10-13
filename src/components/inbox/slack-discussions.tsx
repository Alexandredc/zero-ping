import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import {
  ChevronRightIcon,
  MessageSquareReplyIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Hint } from "./hint"
import { Markdown } from "./markdown"
import type { SlackDiscussion } from "@/server/db/schema"
import {
  slackQuery,
  useRefreshSlack,
  type SlackSubjectInput,
  useSlackRead,
  useSlackReply,
} from "@/hooks/use-inbox"
import { cn } from "@/lib/utils"
import { SlackIcon } from "@/components/brand-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { slackToMarkdown } from "@/lib/slack"
import { timeAgo } from "@/lib/format"

const AGENT_LABEL = { claude: "Claude Code", codex: "Codex" }

const MATCH_LABEL = { link: "lien", reference: "référence", title: "possible" }

const MATCH_HINT = {
  link: "Le message contient le lien de la PR.",
  reference: "Le message cite la PR par sa référence (repo#numéro).",
  title: "Le message parle du sujet de la PR sans la citer : à confirmer.",
}

function ReplyBox({
  itemKey,
  permalink,
  agent,
  onDone,
}: {
  itemKey: string
  permalink: string
  agent: string
  onDone: () => void
}) {
  const [message, setMessage] = useState("")
  const reply = useSlackReply(itemKey)
  const send = () => {
    if (!message.trim() || reply.isPending) return
    reply.mutate({ permalink, message }, { onSuccess: onDone })
  }
  return (
    <div className="flex flex-col gap-2 border-t border-slack/20 pt-2">
      <Textarea
        autoFocus
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            send()
          }
          if (event.key === "Escape") onDone()
        }}
        placeholder="Ta réponse dans le fil Slack…"
        className="min-h-16 bg-background"
        disabled={reply.isPending}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex-1">
          {reply.isPending
            ? `${agent} envoie ta réponse… (20 à 40 s)`
            : `Envoyée en ton nom par ${agent}, telle quelle.`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDone}
          disabled={reply.isPending}
        >
          Annuler
        </Button>
        <Button
          size="sm"
          onClick={send}
          disabled={!message.trim() || reply.isPending}
        >
          {reply.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SlackIcon data-icon="inline-start" />
          )}
          Envoyer sur Slack
          <Kbd>⌘ Entrée</Kbd>
        </Button>
      </div>
    </div>
  )
}

/** `postedAt` of the thread's newest message: reading up to it marks the thread read. */
export function latestPostedAt(discussion: SlackDiscussion): string {
  return discussion.messages.reduce(
    (latest, message) =>
      message.postedAt > latest ? message.postedAt : latest,
    ""
  )
}

function Thread({
  itemKey,
  discussion,
  agent,
  readThrough,
}: {
  itemKey: string
  discussion: SlackDiscussion
  agent: string
  /** `postedAt` of the newest message read, when the thread was marked read. */
  readThrough: string | undefined
}) {
  const [replying, setReplying] = useState(false)
  const markRead = useSlackRead(itemKey)
  const latest = latestPostedAt(discussion)
  const isRead = readThrough !== undefined && readThrough >= latest
  const hasNew = readThrough !== undefined && !isRead
  // A read thread folds away; a new message unfolds it.
  const [open, setOpen] = useState(!isRead)
  const toggleRead = () => {
    markRead.mutate({
      permalink: discussion.permalink,
      readThrough: isRead ? null : latest,
    })
    setOpen(isRead)
  }
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-l-4 border-l-slack bg-slack-surface p-3",
        isRead && "border-l-slack/40 bg-transparent"
      )}
    >
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex items-center gap-2 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRightIcon
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
          <SlackIcon className="size-3.5" />
          <span className="font-medium text-foreground">
            {discussion.channel}
          </span>
        </button>
        <Hint content={MATCH_HINT[discussion.match]}>
          <Badge variant="outline" className="cursor-help">
            {MATCH_LABEL[discussion.match]}
          </Badge>
        </Hint>
        <span>
          {discussion.messages.length} message
          {discussion.messages.length > 1 ? "s" : ""}
        </span>
        {hasNew && (
          <Hint content="Tu l'avais marqué comme lu, mais de nouveaux messages sont arrivés depuis.">
            <Badge
              variant="outline"
              className="cursor-help border-heat/40 text-heat-foreground"
            >
              nouveaux messages
            </Badge>
          </Hint>
        )}
        <Hint
          content="Replie le fil dans Zéro Ping ; il se rouvre si un nouveau message arrive. Rien ne change dans Slack."
          className="ml-auto flex"
        >
          <label className="flex cursor-pointer items-center gap-1.5 rounded border bg-background px-1.5 py-0.5">
            <Checkbox
              checked={isRead}
              onCheckedChange={() => toggleRead()}
              disabled={markRead.isPending}
            />
            Lu
          </label>
        </Hint>
      </header>
      {open && (
        <>
          <ol className="flex flex-col gap-2">
            {discussion.messages.map((message, index) => (
              <li key={index} className="flex flex-col gap-0.5">
                <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {message.author}
                  </span>
                  <span>{timeAgo(message.postedAt)}</span>
                </p>
                <Markdown>{slackToMarkdown(message.text)}</Markdown>
              </li>
            ))}
          </ol>
          {replying ? (
            <ReplyBox
              itemKey={itemKey}
              permalink={discussion.permalink}
              agent={agent}
              onDone={() => setReplying(false)}
            />
          ) : (
            <footer className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplying(true)}
              >
                <MessageSquareReplyIcon data-icon="inline-start" />
                Répondre dans l'app
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={discussion.permalink}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <SlackIcon data-icon="inline-start" />
                Ouvrir le fil dans Slack
              </Button>
            </footer>
          )}
        </>
      )}
    </article>
  )
}

export function SlackDiscussions({
  itemKey,
  subject,
}: {
  itemKey: string
  /** For an issue outside the inbox: what the agent searches Slack for. */
  subject?: SlackSubjectInput
}) {
  const { data, isPending } = useQuery(slackQuery(itemKey, subject))
  const refresh = useRefreshSlack(itemKey, subject)
  const noun = subject?.kind === "Issue" ? "cette issue" : "cette PR"

  if (isPending) return <Skeleton className="h-16 w-full" />
  if (!data?.enabled) return null

  const lookup = data.lookup
  const agent = AGENT_LABEL[data.agent]
  const searching = lookup?.status === "pending" || refresh.isPending
  const discussions = lookup?.discussions ?? []
  const readCount = discussions.filter(
    (d) =>
      (data.reads[d.permalink] ?? "") >= latestPostedAt(d) &&
      d.permalink in data.reads
  ).length
  const linked = discussions.filter((d) => d.match !== "title")
  const possible = discussions.filter((d) => d.match === "title")

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-l-4 border-l-slack bg-card p-4"
      aria-label="Discussions Slack"
    >
      <header className="flex items-center gap-2">
        <SlackIcon />
        <h3 className="text-sm font-semibold">Slack</h3>
        {discussions.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-diff-add-strong transition-[width]"
                style={{
                  width: `${(readCount / discussions.length) * 100}%`,
                }}
              />
            </span>
            {readCount}/{discussions.length} lus
          </span>
        )}
        <Hint
          content={`${agent} cherche dans ton Slack les messages qui citent ${noun} (lien, référence ou sujet), en lecture seule. Les résultats sont gardés 6 h.`}
        >
          <span className="cursor-help text-xs text-muted-foreground">
            {searching
              ? `${agent} cherche… (30 s à 1 min)`
              : lookup?.finishedAt
                ? `vérifié ${timeAgo(lookup.finishedAt)}`
                : ""}
          </span>
        </Hint>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => refresh.mutate()}
          disabled={searching}
          aria-label="Chercher à nouveau dans Slack"
        >
          {searching ? <Spinner /> : <RefreshCwIcon />}
        </Button>
      </header>

      {data.hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {data.hiddenCount} fil{data.hiddenCount > 1 ? "s" : ""} masqué
          {data.hiddenCount > 1 ? "s" : ""} (canaux exclus,{" "}
          <Link
            to="/settings"
            search={{ section: "slack" }}
            className="underline underline-offset-2 hover:text-foreground"
          >
            modifier
          </Link>
          ).
        </p>
      )}
      {lookup?.status === "error" && !searching && (
        <p className="text-xs text-destructive">
          Recherche impossible : {lookup.error}
        </p>
      )}
      {searching && linked.length === 0 && <Skeleton className="h-12 w-full" />}
      {lookup?.status === "done" && discussions.length === 0 && !searching && (
        <p className="text-xs text-muted-foreground">
          Aucune discussion trouvée sur Slack.
        </p>
      )}
      {linked.map((discussion) => (
        <Thread
          key={discussion.permalink}
          itemKey={itemKey}
          discussion={discussion}
          agent={agent}
          readThrough={data.reads[discussion.permalink]}
        />
      ))}
      {possible.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            Discussions possibles, sans lien vers {noun} :
          </p>
          {possible.map((discussion) => (
            <Thread
              key={discussion.permalink}
              itemKey={itemKey}
              discussion={discussion}
              agent={agent}
              readThrough={data.reads[discussion.permalink]}
            />
          ))}
        </>
      )}
    </section>
  )
}
