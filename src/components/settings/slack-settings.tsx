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
import { Switch } from "@/components/ui/switch"
import { useSavePreferences } from "@/hooks/use-inbox"

type Settings = Awaited<ReturnType<typeof getSettings>>

function AddChannel({
  settings,
  onAdd,
}: {
  settings: Settings
  onAdd: (channel: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const excluded = new Set(settings.preferences.slackExcludedChannels)
  const suggestions = settings.slackChannels.filter(
    (channel) => !excluded.has(channel.name)
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
        Exclure un canal
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Nom du canal, par exemple tech-team-general"
          />
          <CommandList>
            <CommandEmpty>
              Aucun canal vu dans les discussions trouvées.
            </CommandEmpty>
            {typed &&
              !excluded.has(typed) &&
              !suggestions.some((c) => c.name === typed) && (
                <CommandGroup heading="Saisie">
                  <CommandItem
                    value={`typed-${typed}`}
                    onSelect={() => add(typed)}
                  >
                    Exclure #{typed}
                  </CommandItem>
                </CommandGroup>
              )}
            {suggestions.length > 0 && (
              <CommandGroup heading="Canaux vus dans les discussions">
                {suggestions.map((channel) => (
                  <CommandItem
                    key={channel.name}
                    value={channel.name}
                    onSelect={() => add(channel.name)}
                  >
                    #{channel.name}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {channel.threads} fil{channel.threads > 1 ? "s" : ""}
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
        <CardDescription>
          Les discussions Slack sur tes PR sont trouvées par l'agent choisi dans
          l'onglet Agent IA, avec ton propre accès Slack, en lecture seule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!settings.env.slackSearchEnabled && (
          <Alert className="mb-4">
            <AlertDescription>
              La recherche Slack est désactivée par{" "}
              <code>SLACK_SEARCH=off</code> dans
              <code>.env</code> : retire cette ligne pour l'activer.
            </AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="slack-auto">
                Recherche automatique
              </FieldLabel>
              <FieldDescription>
                Cherche les discussions des PR à traiter en arrière-plan, trois
                par synchronisation. Désactivée, la recherche ne se lance qu'à
                l'ouverture d'une PR. Chaque recherche coûte environ 0,02 $.
              </FieldDescription>
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
          <Field>
            <FieldLabel>Canaux exclus</FieldLabel>
            <FieldDescription>
              Les fils de ces canaux sont masqués tout de suite, y compris ceux
              déjà trouvés, et l'agent ne les fouille plus.
            </FieldDescription>
            <div className="flex flex-wrap items-center gap-2">
              {excluded.map((channel) => (
                <Badge
                  key={channel}
                  variant="secondary"
                  className="h-7 gap-1 pr-1 text-sm"
                >
                  #{channel}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Ne plus exclure #${channel}`}
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
                  Aucun canal exclu.
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
