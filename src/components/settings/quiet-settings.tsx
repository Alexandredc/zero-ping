import { useQuery } from "@tanstack/react-query"
import { BellOffIcon, RefreshCwIcon } from "lucide-react"
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useI18n } from "@/hooks/use-i18n"
import { quietQuery, useSavePreferences } from "@/hooks/use-inbox"
import { formatWhen } from "@/lib/format"
import { doNotDisturb, isForever } from "@/lib/quiet"

function TimeInput({
  id,
  value,
  disabled,
  onSave,
}: {
  id: string
  value: string
  disabled: boolean
  onSave: (time: string) => void
}) {
  return (
    <Input
      id={id}
      type="time"
      className="w-28"
      disabled={disabled}
      defaultValue={value}
      onBlur={(event) => {
        const time = event.target.value
        if (/^\d{2}:\d{2}$/.test(time) && time !== value) onSave(time)
      }}
    />
  )
}

/** « Ne pas déranger » now, and the hours muted every day. */
export function QuietSettings() {
  const { t, language } = useI18n()
  const m = t.settings.quiet
  const { data } = useQuery(quietQuery())
  const save = useSavePreferences()
  if (!data) return null
  const { reason } = doNotDisturb(data)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellOffIcon className="size-4" />
          {m.title}
        </CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>{m.now}</FieldLabel>
              <FieldDescription>
                {reason === "dnd" && data.dndUntil
                  ? isForever(data.dndUntil)
                    ? m.mutedForever
                    : m.mutedUntil(
                        formatWhen(new Date(data.dndUntil), language)
                      )
                  : reason === "quiet"
                    ? m.quietUntil(data.quietEnd)
                    : m.passing}
              </FieldDescription>
            </FieldContent>
            {reason === "dnd" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => save.mutate({ dndUntil: null })}
              >
                {m.resume}
              </Button>
            )}
          </Field>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="quiet-hours">{m.hours}</FieldLabel>
              <FieldDescription>{m.hoursDescription}</FieldDescription>
            </FieldContent>
            <Switch
              id="quiet-hours"
              checked={data.quietHoursEnabled}
              onCheckedChange={(checked) =>
                save.mutate({ quietHoursEnabled: checked })
              }
            />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="quiet-start">{m.from}</FieldLabel>
            <div className="flex items-center gap-2">
              <TimeInput
                id="quiet-start"
                value={data.quietStart}
                disabled={!data.quietHoursEnabled}
                onSave={(time) => save.mutate({ quietStart: time })}
              />
              <FieldLabel htmlFor="quiet-end">{m.to}</FieldLabel>
              <TimeInput
                id="quiet-end"
                value={data.quietEnd}
                disabled={!data.quietHoursEnabled}
                onSave={(time) => save.mutate({ quietEnd: time })}
              />
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

const INTERVAL_SECONDS = [60, 120, 300, 600, 900, 1800]

/** How often the app asks GitHub for news. */
export function SyncSettings() {
  const { t } = useI18n()
  const m = t.settings.sync
  const { data } = useQuery(quietQuery())
  const save = useSavePreferences()
  if (!data) return null
  const value =
    data.syncIntervalSeconds === null
      ? "auto"
      : String(data.syncIntervalSeconds)
  const github = data.githubIntervalS
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCwIcon className="size-4" />
          {m.title}
        </CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel>{m.interval}</FieldLabel>
          <ToggleGroup
            value={[value]}
            onValueChange={(next) => {
              const choice = next[0]
              if (!choice || choice === value) return
              save.mutate({
                syncIntervalSeconds: choice === "auto" ? null : Number(choice),
              })
            }}
            variant="outline"
            size="sm"
            aria-label={m.intervalLabel}
            className="flex-wrap"
          >
            <ToggleGroupItem value="auto">{m.auto}</ToggleGroupItem>
            {INTERVAL_SECONDS.map((seconds) => (
              <ToggleGroupItem key={seconds} value={String(seconds)}>
                {seconds / 60} min
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>{m.autoDescription(github)}</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
