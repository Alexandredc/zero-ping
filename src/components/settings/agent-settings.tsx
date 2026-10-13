import { useEffect, useState } from "react"
import { BotIcon, SparklesIcon, XIcon } from "lucide-react"
import type { getSettings } from "@/server/inbox/actions"
import { GitHubIcon } from "@/components/brand-icons"
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useSavePreferences } from "@/hooks/use-inbox"
import { LENGTH_LABEL } from "@/components/inbox/summary-card"
import { AGENT_LABEL } from "@/lib/agents"
import type { AgentKind } from "@/lib/agents"
import { SUMMARY_LENGTHS } from "@/server/db/schema"
import type { SummaryLength } from "@/server/db/schema"

type Settings = Awaited<ReturnType<typeof getSettings>>

const DEFAULT_MODEL_HINT: Record<
  AgentKind,
  { fast: string; smart: string; examples: string }
> = {
  claude: {
    fast: "haiku",
    smart: "sonnet",
    examples: "Exemples : haiku, sonnet, opus.",
  },
  codex: {
    fast: "celui de ta config Codex",
    smart: "celui de ta config Codex",
    examples: "Indique un nom accepté par codex --model.",
  },
}

function ModelInput({
  id,
  value,
  placeholder,
  onSave,
}: {
  id: string
  value: string | null
  placeholder: string
  onSave: (model: string | null) => void
}) {
  const [draft, setDraft] = useState(value ?? "")
  useEffect(() => setDraft(value ?? ""), [value])
  const commit = () => {
    const next = draft.trim() || null
    if (next !== value) onSave(next)
  }
  return (
    <Input
      id={id}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      placeholder={placeholder}
      className="max-w-xs font-mono"
    />
  )
}

function ReviewCommandsCard({ commands }: { commands: string[] }) {
  const save = useSavePreferences()
  const [draft, setDraft] = useState("")
  const add = () => {
    const command = draft.trim()
    if (!command || commands.includes(command)) return
    save.mutate({ reviewCommands: [...commands, command] })
    setDraft("")
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BotIcon className="size-4" />
          Reviews IA en un clic
        </CardTitle>
        <CardDescription>
          Le bouton « Review IA » d'une PR poste l'une de ces commandes en
          commentaire, pour déclencher le bot correspondant installé sur le
          repo.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {commands.map((command) => (
            <Badge
              key={command}
              variant="secondary"
              className="h-7 gap-1 pr-1 font-mono text-xs"
            >
              {command}
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Retirer ${command}`}
                onClick={() =>
                  save.mutate({
                    reviewCommands: commands.filter((c) => c !== command),
                  })
                }
              >
                <XIcon />
              </Button>
            </Badge>
          ))}
          {commands.length === 0 && (
            <span className="text-sm text-muted-foreground">
              Aucune commande : le bouton est masqué.
            </span>
          )}
        </div>
        <div className="flex max-w-sm gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && add()}
            placeholder="@copilot review"
            className="font-mono"
            aria-label="Nouvelle commande de review"
          />
          <Button variant="outline" onClick={add} disabled={!draft.trim()}>
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}

export function AgentSettings({ settings }: { settings: Settings }) {
  const save = useSavePreferences()
  const { preferences, env } = settings
  const agent = preferences.agentCli ?? "default"
  const kind = preferences.agentCli ?? env.agent.kind
  const defaults = DEFAULT_MODEL_HINT[kind]
  const envFast =
    kind === env.agent.kind && env.agent.model ? env.agent.model : null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            IA principale
          </CardTitle>
          <CardDescription>
            L'agent en ligne de commande derrière toutes les fonctions IA : les
            résumés, les questions sur une PR ou une issue, la recherche IA, les
            fils et messages Slack et les standups. Il tourne en arrière-plan
            sur ton Mac, dans un dossier temporaire vide. Jev, qui classe et
            note les PR, reste à part.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>IA</FieldLabel>
              <ToggleGroup
                value={[agent]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (!next || next === agent) return
                  // Model names belong to one provider: a new one starts on its defaults.
                  save.mutate({
                    agentCli: next === "default" ? null : (next as AgentKind),
                    agentModel: null,
                    summaryModel: null,
                  })
                }}
                variant="outline"
                size="sm"
                aria-label="IA principale"
              >
                <ToggleGroupItem value="default">
                  Selon .env ({AGENT_LABEL[env.agent.kind]})
                </ToggleGroupItem>
                <ToggleGroupItem value="claude">Claude Code</ToggleGroupItem>
                <ToggleGroupItem value="codex">Codex</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {kind === "claude"
                  ? "Claude Code utilise le connecteur Slack de ton compte claude.ai et lance tes commandes /standup et /standup:team."
                  : "Codex a besoin de son propre serveur MCP Slack dans ~/.codex/config.toml (voir le README). Pour les standups, il suit le texte de tes commandes ~/.claude/commands/standup.md et standup/team.md, avec accès au réseau."}{" "}
                Changer d'IA remet les modèles sur ses valeurs par défaut.
              </FieldDescription>
            </Field>
            <FieldSeparator />
            <Field>
              <FieldLabel htmlFor="agent-model">Modèle rapide</FieldLabel>
              <ModelInput
                id="agent-model"
                value={preferences.agentModel}
                placeholder={`${envFast ?? defaults.fast} (par défaut)`}
                onSave={(model) => save.mutate({ agentModel: model })}
              />
              <FieldDescription>
                Pour les recherches et messages Slack. Laisse vide pour la
                valeur par défaut. {defaults.examples}
              </FieldDescription>
            </Field>
            <FieldSeparator />
            <Field>
              <FieldLabel htmlFor="summary-model">Modèle de lecture</FieldLabel>
              <ModelInput
                id="summary-model"
                value={preferences.summaryModel}
                placeholder={`${defaults.smart} (par défaut)`}
                onSave={(model) => save.mutate({ summaryModel: model })}
              />
              <FieldDescription>
                Pour les résumés, les questions et la recherche IA, qui lisent
                toute la conversation. Les standups gardent le modèle par défaut
                de ton {AGENT_LABEL[kind]}.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            Résumés
          </CardTitle>
          <CardDescription>
            Le bouton « Résumer avec l'IA » d'une PR ou d'une issue utilise l'IA
            principale et son modèle de lecture. Chaque résumé est enregistré et
            reste affiché jusqu'à ce que tu le régénères.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Longueur par défaut</FieldLabel>
              <ToggleGroup
                value={[preferences.summaryLength]}
                onValueChange={(value) => {
                  const next = value[0] as SummaryLength | undefined
                  if (next && next !== preferences.summaryLength) {
                    save.mutate({ summaryLength: next })
                  }
                }}
                variant="outline"
                size="sm"
                aria-label="Longueur par défaut des résumés"
              >
                {SUMMARY_LENGTHS.map((length) => (
                  <ToggleGroupItem key={length} value={length}>
                    {LENGTH_LABEL[length]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                Court : l'essentiel en une phrase. Standard : les points clés.
                Détaillé : toutes les décisions et points en suspens. Tu peux
                changer de longueur sur chaque PR ou issue ; chaque version
                reste enregistrée.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <ReviewCommandsCard commands={preferences.reviewCommands} />

      <Card>
        <CardHeader>
          <CardTitle>Priorité et connexions</CardTitle>
          <CardDescription>
            Ces valeurs viennent de <code>.env</code> et du CLI <code>gh</code>{" "}
            : modifie-les là-bas, puis relance l'app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Fact label="Modèle de priorité">
            <span className="font-mono">{env.decisionModel}</span>
          </Fact>
          <Fact label="Clé Jev (TYPESAFE_AI_API_KEY)">
            {env.jevConfigured ? (
              <Badge variant="secondary">configurée</Badge>
            ) : (
              <Badge variant="destructive">absente : règles seules</Badge>
            )}
          </Fact>
          <Fact label="Compte GitHub">
            <span className="inline-flex items-center gap-1.5">
              <GitHubIcon className="size-3.5" />
              {env.githubLogin ?? "non connecté"}
              <span className="text-muted-foreground">
                via {env.githubTokenSource}
              </span>
            </span>
          </Fact>
        </CardContent>
      </Card>
    </div>
  )
}
