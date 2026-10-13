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
  const { data } = useQuery(quietQuery())
  const save = useSavePreferences()
  if (!data) return null
  const { reason } = doNotDisturb(data)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellOffIcon className="size-4" />
          Ne pas déranger
        </CardTitle>
        <CardDescription>
          Coupe les notifications sans rien changer à l'inbox : ce qui arrive
          pendant ce temps reste dans ses dossiers mais n'est pas notifié
          ensuite. Le récap du jour aussi se tait. Active-le vite depuis la
          barre latérale.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>En ce moment</FieldLabel>
              <FieldDescription>
                {reason === "dnd" && data.dndUntil
                  ? isForever(data.dndUntil)
                    ? "Notifications coupées jusqu'à ce que tu les réactives."
                    : `Notifications coupées jusqu'à ${formatWhen(new Date(data.dndUntil))}.`
                  : reason === "quiet"
                    ? `Heures calmes, jusqu'à ${data.quietEnd}.`
                    : "Les notifications passent."}
              </FieldDescription>
            </FieldContent>
            {reason === "dnd" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => save.mutate({ dndUntil: null })}
              >
                Réactiver
              </Button>
            )}
          </Field>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="quiet-hours">Heures calmes</FieldLabel>
              <FieldDescription>
                Chaque jour, aucune notification entre ces deux heures. La fin
                peut tomber le lendemain (19:00 → 09:00).
              </FieldDescription>
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
            <FieldLabel htmlFor="quiet-start">De</FieldLabel>
            <div className="flex items-center gap-2">
              <TimeInput
                id="quiet-start"
                value={data.quietStart}
                disabled={!data.quietHoursEnabled}
                onSave={(time) => save.mutate({ quietStart: time })}
              />
              <FieldLabel htmlFor="quiet-end">à</FieldLabel>
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

const INTERVALS = [
  { value: "auto", label: "Auto" },
  { value: "60", label: "1 min" },
  { value: "120", label: "2 min" },
  { value: "300", label: "5 min" },
  { value: "600", label: "10 min" },
  { value: "900", label: "15 min" },
  { value: "1800", label: "30 min" },
]

/** How often the app asks GitHub for news. */
export function SyncSettings() {
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
          Synchronisation GitHub
        </CardTitle>
        <CardDescription>
          À quel rythme l'app interroge GitHub pour les notifications, les PR et
          les reviews. Plus espacé, l'app est moins réactive mais consomme moins
          de quota d'API. Le bouton Sync de la barre latérale force une
          synchronisation à tout moment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel>Intervalle</FieldLabel>
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
            aria-label="Intervalle de synchronisation"
            className="flex-wrap"
          >
            {INTERVALS.map((interval) => (
              <ToggleGroupItem key={interval.value} value={interval.value}>
                {interval.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>
            Auto suit le rythme que GitHub demande
            {github ? ` (en ce moment ${github} s)` : ""}, qu'aucun réglage ne
            peut raccourcir. Le changement s'applique dès la prochaine
            synchronisation.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
