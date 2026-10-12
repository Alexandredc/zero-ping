import "@/server/env"
import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

export type AgentKind = "claude" | "codex"

export type AgentTask = {
  prompt: string
  /** JSON Schema the final answer must follow. */
  schema: Record<string, unknown>
  /** Tools the agent may call. Only enforced by Claude Code; Codex uses its own config. */
  allowedTools?: string[]
  timeoutMs?: number
  /** Long material for the agent, sent on stdin rather than in the arguments. */
  input?: string
  /** Extra instructions for Claude Code, kept out of the prompt (a slash command must stay alone there). */
  appendSystemPrompt?: string
}

export type AgentConfig = {
  kind: AgentKind
  command: string
  model: string | undefined
}

const DEFAULT_TIMEOUT_MS = 3 * 60_000
const DEFAULT_MODELS: Record<AgentKind, string | undefined> = {
  claude: "haiku",
  codex: undefined,
}

export type AgentOverrides = {
  agentCli?: AgentKind | null
  agentModel?: string | null
}

/**
 * Coding-agent CLI used for tasks that need the user's own connectors, such as
 * Slack. The settings page overrides AGENT_CLI and AGENT_MODEL; AGENT_COMMAND
 * sets the binary when it is not on the PATH. A model from `.env` only applies
 * to the agent it was written for.
 */
export function getAgentConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: AgentOverrides = {}
): AgentConfig {
  const envKind: AgentKind = env.AGENT_CLI === "codex" ? "codex" : "claude"
  const kind = overrides.agentCli ?? envKind
  const envModel = kind === envKind ? env.AGENT_MODEL : undefined
  return {
    kind,
    command: (kind === envKind ? env.AGENT_COMMAND : undefined) ?? kind,
    model: overrides.agentModel ?? envModel ?? DEFAULT_MODELS[kind],
  }
}

export function buildClaudeArgs(
  task: AgentTask,
  model: string | undefined
): string[] {
  return [
    "-p",
    task.prompt,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(task.schema),
    "--no-session-persistence",
    ...(task.allowedTools?.length
      ? ["--allowedTools", task.allowedTools.join(" ")]
      : []),
    ...(task.appendSystemPrompt
      ? ["--append-system-prompt", task.appendSystemPrompt]
      : []),
    ...(model ? ["--model", model] : []),
  ]
}

export function buildCodexArgs(
  task: AgentTask,
  model: string | undefined,
  files: { schema: string; output: string }
): string[] {
  return [
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--output-schema",
    files.schema,
    "--output-last-message",
    files.output,
    ...(model ? ["--model", model] : []),
    task.prompt,
  ]
}

/** Claude Code prints one JSON result object; the typed answer is `structured_output`. */
export function parseClaudeOutput(stdout: string): unknown {
  const start = stdout.indexOf("{")
  if (start < 0) throw new Error("Claude Code n'a renvoyé aucun résultat JSON.")
  const result = JSON.parse(stdout.slice(start)) as {
    is_error?: boolean
    result?: string
    structured_output?: unknown
  }
  if (result.is_error) throw new Error(result.result ?? "Claude Code a échoué.")
  if (result.structured_output === undefined) {
    throw new Error("Claude Code n'a pas renvoyé de réponse structurée.")
  }
  return result.structured_output
}

/**
 * The claude.ai connectors (Slack…) only exist for a claude.ai login: an API key
 * inherited from `.env` would switch Claude Code to API billing without them.
 */
export function agentEnv(
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY: _apiKey, ...rest } = env
  return rest
}

function run(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  input?: string
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: agentEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    })
    // Closing stdin right away also tells Claude Code not to wait for input.
    child.stdin.end(input ?? "")
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()))
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()))
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs)
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(
              `Commande « ${command} » introuvable : installe-la ou définis AGENT_COMMAND.`
            )
          : error
      )
    })
    child.on("close", (code, signal) => {
      clearTimeout(timer)
      if (signal)
        return reject(
          new Error(`L'agent a dépassé ${Math.round(timeoutMs / 1000)} s.`)
        )
      if (code !== 0) {
        return reject(
          new Error(
            stderr.trim().split("\n").pop() ||
              `L'agent a quitté avec le code ${code}.`
          )
        )
      }
      resolve(stdout)
    })
  })
}

/**
 * Runs the configured agent headlessly in an empty temporary directory, so it
 * does not pick up this project's instructions, and returns its typed answer.
 */
export async function runAgent(
  task: AgentTask,
  config: AgentConfig = getAgentConfig()
): Promise<unknown> {
  const workdir = await mkdtemp(path.join(tmpdir(), "zero-ping-agent-"))
  const timeoutMs = task.timeoutMs ?? DEFAULT_TIMEOUT_MS
  try {
    if (config.kind === "claude") {
      const stdout = await run(
        config.command,
        buildClaudeArgs(task, config.model),
        workdir,
        timeoutMs,
        task.input
      )
      return parseClaudeOutput(stdout)
    }
    const files = {
      schema: path.join(workdir, "schema.json"),
      output: path.join(workdir, "answer.json"),
    }
    await writeFile(files.schema, JSON.stringify(task.schema))
    await run(
      config.command,
      buildCodexArgs(task, config.model, files),
      workdir,
      timeoutMs,
      task.input
    )
    return JSON.parse(await readFile(files.output, "utf8"))
  } finally {
    await rm(workdir, { recursive: true, force: true })
  }
}
