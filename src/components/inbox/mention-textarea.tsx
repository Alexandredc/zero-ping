import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { mentionsQuery } from "@/hooks/use-inbox"
import { avatarUrl } from "@/lib/format"
import { insertMention, mentionQueryAt, rankMentions } from "@/lib/mentions"
import { cn } from "@/lib/utils"

type Props = Omit<React.ComponentProps<typeof Textarea>, "onChange"> & {
  /** `owner/repo`, whose members are offered after an `@`. */
  repo: string | null
  value: string
  onValueChange: (value: string) => void
}

/**
 * A GitHub comment box: typing `@` lists the people of the repo, and ↑ ↓ then
 * Entrée or Tab inserts the chosen login.
 */
export function MentionTextarea({
  repo,
  value,
  onValueChange,
  onKeyDown,
  ref,
  className,
  ...props
}: Props) {
  const [mention, setMention] = useState<{
    start: number
    query: string
    caret: number
  } | null>(null)
  const [active, setActive] = useState(0)
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null)
  const { data: people = [] } = useQuery({
    ...mentionsQuery(repo ?? ""),
    enabled: Boolean(repo) && mention !== null,
  })
  const suggestions = mention ? rankMentions(people, mention.query) : []
  const open = suggestions.length > 0

  const track = (element: HTMLTextAreaElement) => {
    const caret = element.selectionStart
    const found = mentionQueryAt(element.value, caret)
    setMention(found && { ...found, caret })
    setActive(0)
  }

  const choose = (login: string) => {
    if (!mention) return
    const next = insertMention(value, mention.start, mention.caret, login)
    onValueChange(next.value)
    setMention(null)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.caret, next.caret)
    })
  }

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={(element) => {
          setTextarea(element)
          if (typeof ref === "function") ref(element)
          else if (ref) ref.current = element
        }}
        value={value}
        className={className}
        aria-autocomplete="list"
        aria-expanded={open}
        onChange={(event) => {
          onValueChange(event.target.value)
          track(event.target)
        }}
        onClick={(event) => track(event.currentTarget)}
        onBlur={() => setMention(null)}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              const step = event.key === "ArrowDown" ? 1 : -1
              setActive(
                (current) =>
                  (current + step + suggestions.length) % suggestions.length
              )
              return
            }
            if (
              (event.key === "Enter" || event.key === "Tab") &&
              !event.metaKey &&
              !event.ctrlKey
            ) {
              event.preventDefault()
              choose(suggestions[active].login)
              return
            }
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              setMention(null)
              return
            }
          }
          onKeyDown?.(event)
        }}
      />
      {open && (
        <ul
          role="listbox"
          aria-label="Personnes à mentionner"
          className="absolute bottom-full left-0 z-20 mb-1 flex w-72 flex-col overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {suggestions.map((person, index) => (
            <li
              key={person.login}
              role="option"
              aria-selected={index === active}
              // mousedown keeps the textarea focused, unlike click.
              onMouseDown={(event) => {
                event.preventDefault()
                choose(person.login)
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                index === active && "bg-muted"
              )}
            >
              <Avatar className="size-5">
                <AvatarImage src={avatarUrl(person.login)} alt="" />
                <AvatarFallback className="text-[0.5rem]">
                  {person.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">@{person.login}</span>
              {person.name && (
                <span className="truncate text-xs text-muted-foreground">
                  {person.name}
                </span>
              )}
            </li>
          ))}
          <li className="px-2 pt-1 text-[0.65rem] text-muted-foreground">
            ↑ ↓ pour choisir, Entrée ou Tab pour insérer
          </li>
        </ul>
      )}
    </div>
  )
}
