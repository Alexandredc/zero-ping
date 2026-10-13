export type AgentKind = "claude" | "codex"

/** The main AI's CLI, as the settings and the Slack card name it. */
export const AGENT_LABEL: Record<AgentKind, string> = {
  claude: "Claude Code",
  codex: "Codex",
}
