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
import { useSavePreferences } from "@/hooks/use-inbox"

type Settings = Awaited<ReturnType<typeof getSettings>>

type RuleKey =
  "autoDoneClosed" | "autoDoneBots" | "autoDoneCi" | "autoDoneReleases"

const RULES: { key: RuleKey; label: string; description: string }[] = [
  {
    key: "autoDoneClosed",
    label: "PR et issues mergées ou fermées",
    description: "Une fois fermées, il n'y a plus rien à y faire.",
  },
  {
    key: "autoDoneBots",
    label: "PR et issues de bots",
    description:
      "Dependabot, Renovate, GitHub Actions et autres comptes [bot].",
  },
  {
    key: "autoDoneCi",
    label: "Activité CI",
    description:
      "Les notifications de workflows terminés. Les échecs de tes PR restent signalés dans « Mes PR ».",
  },
  {
    key: "autoDoneReleases",
    label: "Releases",
    description: "Les nouvelles versions publiées sur les repos suivis.",
  },
]

function SwitchField({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  )
}

function AuthorList({ preferences }: { preferences: Preferences }) {
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
      <FieldLabel htmlFor="auto-done-author">Auteurs à classer</FieldLabel>
      <FieldDescription>
        Les notifications de ces comptes GitHub sont classées d'office, sauf
        quand elles te mentionnent ou te demandent une review.
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
          placeholder="login GitHub, par ex. release-bot"
        />
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          Ajouter
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
                aria-label={`Retirer @${login}`}
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
  const save = useSavePreferences()
  const { preferences } = settings
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArchiveIcon className="size-4" />
            Classement automatique
          </CardTitle>
          <CardDescription>
            À chaque synchro, ces notifications passent dans « Traités », ici et
            sur GitHub. Celles qui t'attendent (review, mention, réponse) ne
            sont jamais classées, et tout revient s'il y a du nouveau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <FieldSet>
              <FieldLegend variant="label">Classer d'office</FieldLegend>
              {RULES.map((rule) => (
                <SwitchField
                  key={rule.key}
                  id={rule.key}
                  label={rule.label}
                  description={rule.description}
                  checked={preferences[rule.key]}
                  onChange={(checked) => save.mutate({ [rule.key]: checked })}
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
            Vue équipe
          </CardTitle>
          <CardDescription>
            Les PR ouvertes des repos suivis, hors les tiennes et celles des
            bots, mises à jour toutes les 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="team-stale-days">
                Ancienne au-delà de
              </FieldLabel>
              <FieldDescription>
                Nombre de jours depuis l'ouverture d'une PR avant qu'elle soit
                signalée comme « ouverte depuis longtemps ».
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

export function RecapSettings({ settings }: { settings: Settings }) {
  const save = useSavePreferences()
  const { preferences } = settings
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SunriseIcon className="size-4" />
          Récap du jour
        </CardTitle>
        <CardDescription>
          Chaque jour ouvré, une notification résume ce qui t'attend. Si l'app
          était éteinte à l'heure choisie, le récap part à son démarrage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <SwitchField
            id="recap-enabled"
            label="Envoyer le récap"
            description="Une notification du navigateur, qui ouvre la page Récap du jour."
            checked={preferences.recapEnabled}
            onChange={(checked) => save.mutate({ recapEnabled: checked })}
          />
          <Field
            orientation="horizontal"
            data-disabled={!preferences.recapEnabled || undefined}
          >
            <FieldContent>
              <FieldLabel htmlFor="recap-time">Heure</FieldLabel>
              <FieldDescription>
                Après le « Daily standup reminder » de 9 h, pour que le standup
                trouve son fil Slack.
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
          <SwitchField
            id="standup-enabled"
            label="Lancer /standup:team avec le récap"
            description="Claude Code exporte le board et rédige le standup. Tu le relis dans le récap du jour, puis tu le publies d'un clic dans le fil du jour de #tech-team-general."
            checked={preferences.standupEnabled}
            onChange={(checked) => save.mutate({ standupEnabled: checked })}
          />
          <FieldSeparator />
          <SwitchField
            id="my-standup-enabled"
            label="Lancer /standup avec le récap"
            description="Claude Code rédige ton propre standup à partir de tes PR et de tes reviews. Tu le relis dans le récap du jour, puis tu le publies d'un clic dans le même fil."
            checked={preferences.myStandupEnabled}
            onChange={(checked) => save.mutate({ myStandupEnabled: checked })}
          />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
