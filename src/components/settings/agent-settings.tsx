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
import { useI18n } from "@/hooks/use-i18n"
import { useSavePreferences } from "@/hooks/use-inbox"
import { AGENT_LABEL } from "@/lib/agents"
import type { AgentKind } from "@/lib/agents"
import type { Messages } from "@/lib/i18n/messages"
import { SUMMARY_LENGTHS } from "@/server/db/schema"
import type { SummaryLength } from "@/server/db/schema"

type Settings = Awaited<ReturnType<typeof getSettings>>

function defaultModelHint(
  kind: AgentKind,
  t: Messages
): { fast: string; smart: string; examples: string } {
  const { agent } = t.settings
  return kind === "claude"
    ? { fast: "haiku", smart: "sonnet", examples: agent.claudeExamples }
    : {
        fast: agent.codexConfigModel,
        smart: agent.codexConfigModel,
        examples: agent.codexExamples,
      }
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
  const { t } = useI18n()
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
          {t.settings.agent.reviewCommandsTitle}
        </CardTitle>
        <CardDescription>
          {t.settings.agent.reviewCommandsDescription}
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
                aria-label={t.settings.remove(command)}
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
              {t.settings.agent.noReviewCommand}
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
            aria-label={t.settings.agent.newReviewCommand}
          />
          <Button variant="outline" onClick={add} disabled={!draft.trim()}>
            {t.settings.add}
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
  const { t } = useI18n()
  const save = useSavePreferences()
  const { preferences, env } = settings
  const agent = preferences.agentCli ?? "default"
  const kind = preferences.agentCli ?? env.agent.kind
  const defaults = defaultModelHint(kind, t)
  const envFast =
    kind === env.agent.kind && env.agent.model ? env.agent.model : null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            {t.settings.agent.mainTitle}
          </CardTitle>
          <CardDescription>{t.settings.agent.mainDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t.settings.agent.ai}</FieldLabel>
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
                aria-label={t.settings.agent.mainTitle}
              >
                <ToggleGroupItem value="default">
                  {t.settings.agent.fromEnv(AGENT_LABEL[env.agent.kind])}
                </ToggleGroupItem>
                <ToggleGroupItem value="claude">Claude Code</ToggleGroupItem>
                <ToggleGroupItem value="codex">Codex</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {kind === "claude"
                  ? t.settings.agent.claudeHint
                  : t.settings.agent.codexHint}{" "}
                {t.settings.agent.switchResetsModels}
              </FieldDescription>
            </Field>
            <FieldSeparator />
            <Field>
              <FieldLabel htmlFor="agent-model">
                {t.settings.agent.fastModel}
              </FieldLabel>
              <ModelInput
                id="agent-model"
                value={preferences.agentModel}
                placeholder={t.settings.agent.defaultModel(
                  envFast ?? defaults.fast
                )}
                onSave={(model) => save.mutate({ agentModel: model })}
              />
              <FieldDescription>
                {t.settings.agent.fastModelDescription(defaults.examples)}
              </FieldDescription>
            </Field>
            <FieldSeparator />
            <Field>
              <FieldLabel htmlFor="summary-model">
                {t.settings.agent.readingModel}
              </FieldLabel>
              <ModelInput
                id="summary-model"
                value={preferences.summaryModel}
                placeholder={t.settings.agent.defaultModel(defaults.smart)}
                onSave={(model) => save.mutate({ summaryModel: model })}
              />
              <FieldDescription>
                {t.settings.agent.readingModelDescription(AGENT_LABEL[kind])}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            {t.settings.agent.summariesTitle}
          </CardTitle>
          <CardDescription>
            {t.settings.agent.summariesDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t.settings.agent.defaultLength}</FieldLabel>
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
                aria-label={t.settings.agent.defaultLengthLabel}
              >
                {SUMMARY_LENGTHS.map((length) => (
                  <ToggleGroupItem key={length} value={length}>
                    {t.settings.agent.lengths[length]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                {t.settings.agent.lengthsDescription}
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <ReviewCommandsCard commands={preferences.reviewCommands} />

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.agent.connectionsTitle}</CardTitle>
          <CardDescription>
            {t.settings.agent.connectionsDescription(
              <code key="env">.env</code>,
              <code key="gh">gh</code>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Fact label={t.settings.agent.decisionModel}>
            <span className="font-mono">{env.decisionModel}</span>
          </Fact>
          <Fact label={t.settings.agent.jevKey}>
            {env.jevConfigured ? (
              <Badge variant="secondary">
                {t.settings.agent.jevConfigured}
              </Badge>
            ) : (
              <Badge variant="destructive">{t.settings.agent.jevMissing}</Badge>
            )}
          </Fact>
          <Fact label={t.settings.agent.githubAccount}>
            <span className="inline-flex items-center gap-1.5">
              <GitHubIcon className="size-3.5" />
              {env.githubLogin ?? t.settings.agent.notConnected}
              <span className="text-muted-foreground">
                {t.settings.agent.via(env.githubTokenSource)}
              </span>
            </span>
          </Fact>
        </CardContent>
      </Card>
    </div>
  )
}
