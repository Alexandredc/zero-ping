import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import type { getSettings } from "@/server/inbox/actions"
import { SlackIcon } from "@/components/brand-icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/hooks/use-i18n"
import { useSavePreferences } from "@/hooks/use-inbox"

type Settings = Awaited<ReturnType<typeof getSettings>>

type Channel = Settings["slackChannels"][number]

function isExcluded(channel: Channel, excluded: Set<string>) {
  return (
    excluded.has(channel.id) || channel.names.some((name) => excluded.has(name))
  )
}

/** An excluded entry as the page shows it: a known channel's usual name, else the entry. */
function exclusionLabel(entry: string, channels: Channel[]) {
  const channel = channels.find(
    (c) => c.id === entry || c.names.includes(entry)
  )
  return channel ? channel.name : entry
}

function AddChannel({
  settings,
  onAdd,
}: {
  settings: Settings
  onAdd: (channel: string) => void
}) {
  const { t } = useI18n()
  const m = t.settings.slack
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const excluded = new Set(settings.preferences.slackExcludedChannels)
  const suggestions = settings.slackChannels.filter(
    (channel) => !isExcluded(channel, excluded)
  )
  const typed = query.trim().replace(/^#/, "").toLowerCase()
  const add = (channel: string) => {
    onAdd(channel)
    setQuery("")
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        {m.exclude}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={m.channelPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{m.noChannel}</CommandEmpty>
            {typed &&
              !excluded.has(typed) &&
              !suggestions.some((c) => c.name === typed) && (
                <CommandGroup heading={m.typed}>
                  <CommandItem
                    value={`typed-${typed}`}
                    onSelect={() => add(typed)}
                  >
                    {m.excludeTyped(typed)}
                  </CommandItem>
                </CommandGroup>
              )}
            {suggestions.length > 0 && (
              <CommandGroup heading={m.seenChannels}>
                {suggestions.map((channel) => (
                  <CommandItem
                    key={channel.id}
                    value={channel.id}
                    keywords={channel.names}
                    // The id stays the same whatever name the agent gives the channel next.
                    onSelect={() => add(channel.id)}
                  >
                    #{channel.name}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {m.threads(channel.threads)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function SlackSettings({ settings }: { settings: Settings }) {
  const { t } = useI18n()
  const m = t.settings.slack
  const save = useSavePreferences()
  const { preferences } = settings
  const excluded = preferences.slackExcludedChannels

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlackIcon />
          Slack
        </CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!settings.env.slackSearchEnabled && (
          <Alert className="mb-4">
            <AlertDescription>
              {m.disabled(
                <code key="flag">SLACK_SEARCH=off</code>,
                <code key="file">.env</code>
              )}
            </AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="slack-auto">{m.autoSearch}</FieldLabel>
              <FieldDescription>{m.autoSearchDescription}</FieldDescription>
            </FieldContent>
            <Switch
              id="slack-auto"
              checked={preferences.slackAutoSearch}
              onCheckedChange={(checked) =>
                save.mutate({ slackAutoSearch: checked })
              }
            />
          </Field>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="review-notice">{m.reviewNotice}</FieldLabel>
              <FieldDescription>{m.reviewNoticeDescription}</FieldDescription>
            </FieldContent>
            <Switch
              id="review-notice"
              checked={preferences.reviewNoticeEnabled}
              onCheckedChange={(checked) =>
                save.mutate({ reviewNoticeEnabled: checked })
              }
            />
          </Field>
          <Field
            orientation="horizontal"
            data-disabled={!preferences.reviewNoticeEnabled || undefined}
          >
            <FieldContent>
              <FieldLabel htmlFor="review-notice-channel">
                {m.reviewChannel}
              </FieldLabel>
              <FieldDescription>{m.reviewChannelDescription}</FieldDescription>
            </FieldContent>
            <Input
              id="review-notice-channel"
              key={preferences.reviewNoticeChannel}
              defaultValue={preferences.reviewNoticeChannel}
              disabled={!preferences.reviewNoticeEnabled}
              className="w-48"
              onBlur={(event) => {
                const channel = event.target.value.trim().replace(/^#/, "")
                if (channel && channel !== preferences.reviewNoticeChannel)
                  save.mutate({ reviewNoticeChannel: channel })
              }}
            />
          </Field>
          <FieldSeparator />
          <Field>
            <FieldLabel>{m.excluded}</FieldLabel>
            <FieldDescription>{m.excludedDescription}</FieldDescription>
            <div className="flex flex-wrap items-center gap-2">
              {excluded.map((channel) => (
                <Badge
                  key={channel}
                  variant="secondary"
                  className="h-7 gap-1 pr-1 text-sm"
                >
                  #{exclusionLabel(channel, settings.slackChannels)}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={m.unexclude(
                      exclusionLabel(channel, settings.slackChannels)
                    )}
                    onClick={() =>
                      save.mutate({
                        slackExcludedChannels: excluded.filter(
                          (c) => c !== channel
                        ),
                      })
                    }
                  >
                    <XIcon />
                  </Button>
                </Badge>
              ))}
              {excluded.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {m.noneExcluded}
                </span>
              )}
              <AddChannel
                settings={settings}
                onAdd={(channel) =>
                  save.mutate({ slackExcludedChannels: [...excluded, channel] })
                }
              />
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
