import { useState } from "react"
import { ArchiveIcon, SunriseIcon, UsersIcon, XIcon } from "lucide-react"
import type { getSettings } from "@/server/inbox/actions"
import type { Preferences } from "@/server/preferences"
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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/hooks/use-i18n"
import { useSavePreferences } from "@/hooks/use-inbox"
import { cn } from "@/lib/utils"

type Settings = Awaited<ReturnType<typeof getSettings>>

type RuleKey =
  "autoDoneClosed" | "autoDoneBots" | "autoDoneCi" | "autoDoneReleases"

const RULES: RuleKey[] = [
  "autoDoneClosed",
  "autoDoneBots",
  "autoDoneCi",
  "autoDoneReleases",
]

function SwitchField({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </Field>
  )
}

function AuthorList({ preferences }: { preferences: Preferences }) {
  const { t } = useI18n()
  const save = useSavePreferences()
  const [draft, setDraft] = useState("")
  const authors = preferences.autoDoneAuthors
  const add = () => {
    const login = draft.trim().replace(/^@/, "")
    if (!login) return
    save.mutate(
      { autoDoneAuthors: [...authors, login] },
      { onSuccess: () => setDraft("") }
    )
  }
  return (
    <Field>
      <FieldLabel htmlFor="auto-done-author">
        {t.settings.triage.authors.label}
      </FieldLabel>
      <FieldDescription>
        {t.settings.triage.authors.description}
      </FieldDescription>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <Input
          id="auto-done-author"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t.settings.triage.authors.placeholder}
        />
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          {t.settings.add}
        </Button>
      </form>
      {authors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {authors.map((login) => (
            <Badge key={login} variant="secondary" className="gap-1 pr-0.5">
              @{login}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t.settings.remove(`@${login}`)}
                onClick={() =>
                  save.mutate({
                    autoDoneAuthors: authors.filter((a) => a !== login),
                  })
                }
              >
                <XIcon />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </Field>
  )
}

export function TriageSettings({ settings }: { settings: Settings }) {
  const { t } = useI18n()
  const save = useSavePreferences()
  const { preferences } = settings
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArchiveIcon className="size-4" />
            {t.settings.triage.title}
          </CardTitle>
          <CardDescription>{t.settings.triage.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">
                {t.settings.triage.legend}
              </FieldLegend>
              {RULES.map((rule) => (
                <SwitchField
                  key={rule}
                  id={rule}
                  label={t.settings.triage.rules[rule].label}
                  description={t.settings.triage.rules[rule].description}
                  checked={preferences[rule]}
                  onChange={(checked) => save.mutate({ [rule]: checked })}
                />
              ))}
            </FieldSet>
            <FieldSeparator />
            <AuthorList preferences={preferences} />
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="size-4" />
            {t.settings.team.title}
          </CardTitle>
          <CardDescription>{t.settings.team.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="team-stale-days">
                {t.settings.team.staleLabel}
              </FieldLabel>
              <FieldDescription>
                {t.settings.team.staleDescription}
              </FieldDescription>
            </FieldContent>
            <Input
              id="team-stale-days"
              type="number"
              min={1}
              max={90}
              className="w-20"
              defaultValue={preferences.teamStaleDays}
              onBlur={(event) => {
                const days = Number(event.target.value)
                if (
                  Number.isInteger(days) &&
                  days >= 1 &&
                  days <= 90 &&
                  days !== preferences.teamStaleDays
                )
                  save.mutate({ teamStaleDays: days })
              }}
            />
          </Field>
        </CardContent>
      </Card>
    </div>
  )
}

const isCommand = (value: string) => /^\/[\w.-]+(:[\w.-]+)*$/.test(value)

/** A text setting saved when the field loses focus or on Enter. */
function TextField({
  id,
  label,
  description,
  value,
  placeholder,
  prefix,
  mono,
  onSave,
}: {
  id: string
  label: string
  description: string
  value: string
  placeholder: string
  prefix?: string
  mono?: boolean
  onSave: (value: string) => void
}) {
  const commit = (next: string) => {
    const trimmed = next.trim().replace(/^#/, "")
    if (trimmed !== value) onSave(trimmed)
  }
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <div className="flex items-center gap-1">
        {prefix && (
          <span className="text-sm text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={id}
          key={value}
          defaultValue={value}
          placeholder={placeholder}
          className={cn("w-56", mono && "font-mono")}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) =>
            event.key === "Enter" && commit(event.currentTarget.value)
          }
        />
      </div>
    </Field>
  )
}

export function RecapSettings({ settings }: { settings: Settings }) {
  const { t } = useI18n()
  const m = t.settings.recap
  const save = useSavePreferences()
  const { preferences } = settings
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SunriseIcon className="size-4" />
          {m.title}
        </CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SwitchField
            id="recap-enabled"
            label={m.enabled}
            description={m.enabledDescription}
            checked={preferences.recapEnabled}
            onChange={(checked) => save.mutate({ recapEnabled: checked })}
          />
          <Field
            orientation="horizontal"
            data-disabled={!preferences.recapEnabled || undefined}
          >
            <FieldContent>
              <FieldLabel htmlFor="recap-time">{m.time}</FieldLabel>
              <FieldDescription>
                {m.timeDescription(preferences.standupReminder)}
              </FieldDescription>
            </FieldContent>
            <Input
              id="recap-time"
              type="time"
              className="w-28"
              disabled={!preferences.recapEnabled}
              defaultValue={preferences.recapTime}
              onBlur={(event) => {
                const time = event.target.value
                if (
                  /^\d{2}:\d{2}$/.test(time) &&
                  time !== preferences.recapTime
                )
                  save.mutate({ recapTime: time })
              }}
            />
          </Field>
          <FieldSeparator />
          <TextField
            id="standup-channel"
            label={m.channel}
            description={m.channelDescription}
            value={preferences.standupChannel}
            placeholder="daily-standup"
            prefix="#"
            onSave={(standupChannel) => save.mutate({ standupChannel })}
          />
          <TextField
            id="standup-reminder"
            label={m.reminder}
            description={m.reminderDescription}
            value={preferences.standupReminder}
            placeholder="Daily standup reminder"
            onSave={(standupReminder) =>
              standupReminder && save.mutate({ standupReminder })
            }
          />
          <FieldSeparator />
          <SwitchField
            id="standup-enabled"
            label={m.runWithRecap(preferences.teamStandupCommand)}
            description={m.teamStandupDescription(preferences.standupChannel)}
            checked={preferences.standupEnabled}
            disabled={!preferences.standupChannel}
            onChange={(checked) => save.mutate({ standupEnabled: checked })}
          />
          <TextField
            id="team-standup-command"
            label={m.teamCommand}
            description={m.commandDescription}
            value={preferences.teamStandupCommand}
            placeholder="/standup:team"
            mono
            onSave={(teamStandupCommand) =>
              isCommand(teamStandupCommand) &&
              save.mutate({ teamStandupCommand })
            }
          />
          <FieldSeparator />
          <SwitchField
            id="my-standup-enabled"
            label={m.runWithRecap(preferences.myStandupCommand)}
            description={m.myStandupDescription}
            checked={preferences.myStandupEnabled}
            disabled={!preferences.standupChannel}
            onChange={(checked) => save.mutate({ myStandupEnabled: checked })}
          />
          <TextField
            id="my-standup-command"
            label={m.myCommand}
            description={m.commandDescription}
            value={preferences.myStandupCommand}
            placeholder="/standup"
            mono
            onSave={(myStandupCommand) =>
              isCommand(myStandupCommand) && save.mutate({ myStandupCommand })
            }
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
