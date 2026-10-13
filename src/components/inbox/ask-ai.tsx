import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
  ArrowUpIcon,
  MessageCircleQuestionIcon,
  Trash2Icon,
} from "lucide-react"
import { Hint } from "./hint"
import { Markdown } from "./markdown"
import { chatQuery, useAskAi, useClearChat } from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useI18n } from "@/hooks/use-i18n"

/**
 * Questions to the AI about the item, under its summary. It reads the
 * conversation, the Slack threads and, for a PR, the diff; the thread is kept.
 */
export function AskAi({
  itemKey,
  kind,
}: {
  itemKey: string
  kind: "PR" | "issue"
}) {
  const { t } = useI18n()
  const copy = t.detail.ask
  const { data, isPending } = useQuery(chatQuery(itemKey))
  const ask = useAskAi(itemKey)
  const clear = useClearChat(itemKey)
  const [question, setQuestion] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const messages = data?.messages ?? []

  // Follows a new question or answer, but leaves the panel where it opens.
  const seen = useRef<number | null>(null)
  useEffect(() => {
    if (isPending) return
    const count = messages.length + (ask.isPending ? 1 : 0)
    if (seen.current !== null && count > seen.current)
      bottomRef.current?.scrollIntoView({ block: "nearest" })
    seen.current = count
  }, [isPending, messages.length, ask.isPending])

  const send = (text = question) => {
    const trimmed = text.trim()
    if (!trimmed || ask.isPending) return
    ask.mutate(trimmed, { onSuccess: () => setQuestion("") })
    setQuestion(trimmed)
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <header className="flex items-center gap-2">
        <MessageCircleQuestionIcon className="size-4 text-muted-foreground" />
        <h4 className="text-xs font-medium text-muted-foreground">
          {copy.title}
        </h4>
        {messages.length > 0 && (
          <Hint content={copy.clearHint}>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              onClick={() => clear.mutate()}
              disabled={clear.isPending || ask.isPending}
              aria-label={copy.clear}
            >
              <Trash2Icon />
            </Button>
          </Hint>
        )}
      </header>

      {isPending && <Skeleton className="h-8 w-full" />}
      {messages.length > 0 && (
        <ol className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <li
              key={index}
              className={cn(
                "flex flex-col gap-1 text-sm",
                message.role === "user" &&
                  "self-end rounded-lg bg-muted px-3 py-2"
              )}
            >
              {message.role === "user" ? (
                message.content
              ) : (
                <Markdown>{message.content}</Markdown>
              )}
            </li>
          ))}
        </ol>
      )}
      {ask.isPending && (
        <>
          <p className="self-end rounded-lg bg-muted px-3 py-2 text-sm">
            {question}
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner /> {copy.reading(kind === "PR")}
          </p>
        </>
      )}
      {!isPending && messages.length === 0 && !ask.isPending && (
        <div className="flex flex-wrap gap-1.5">
          {copy.suggestions[kind].map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="xs"
              onClick={() => send(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      <div ref={bottomRef} />

      <div className="flex items-end gap-2">
        <Textarea
          value={ask.isPending ? "" : question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              send()
            }
            if (event.key === "Escape") event.currentTarget.blur()
          }}
          placeholder={copy.placeholder(kind)}
          disabled={ask.isPending}
          className="max-h-40 min-h-9 bg-background"
          rows={1}
        />
        <Hint
          content={
            <>
              {copy.sendHintStart}
              <Kbd>{t.detail.composer.keysEnter}</Kbd>,{" "}
              <Kbd>{copy.sendHintShift}</Kbd>{" "}
              <Kbd>{t.detail.composer.keysEnter}</Kbd> {copy.sendHintEnd}
            </>
          }
          className="flex"
        >
          <Button
            size="icon-sm"
            onClick={() => send()}
            disabled={!question.trim() || ask.isPending}
            aria-label={copy.send}
          >
            {ask.isPending ? <Spinner /> : <ArrowUpIcon />}
          </Button>
        </Hint>
      </div>
    </div>
  )
}
