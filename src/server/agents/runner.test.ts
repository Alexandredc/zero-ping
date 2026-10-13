import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  agentEnv,
  buildClaudeArgs,
  buildCodexArgs,
  getAgentConfig,
  parseClaudeOutput,
  runAgent,
} from "./runner"

const task = {
  prompt: "Find threads",
  schema: { type: "object" },
  allowedTools: ["a", "b"],
}

describe("getAgentConfig", () => {
  it("defaults to Claude Code with Haiku", () => {
    expect(getAgentConfig({})).toEqual({
      kind: "claude",
      command: "claude",
      model: "haiku",
    })
  })

  it("switches to Codex with its own model and binary", () => {
    expect(
      getAgentConfig({
        AGENT_CLI: "codex",
        AGENT_COMMAND: "/opt/codex",
        AGENT_MODEL: "gpt-6",
      })
    ).toEqual({
      kind: "codex",
      command: "/opt/codex",
      model: "gpt-6",
    })
    expect(getAgentConfig({ AGENT_CLI: "codex" }).model).toBeUndefined()
  })

  it("picks the model of the role, for the main AI of the settings", () => {
    expect(getAgentConfig({}, {}, "smart").model).toBe("sonnet")
    expect(
      getAgentConfig({ AGENT_MODEL: "opus" }, { summaryModel: null }, "smart")
        .model
    ).toBe("sonnet")
    expect(
      getAgentConfig({}, { agentCli: "codex" }, "smart").model
    ).toBeUndefined()
    expect(
      getAgentConfig(
        {},
        { agentCli: "codex", agentModel: "gpt-6-mini", summaryModel: "gpt-6" },
        "smart"
      )
    ).toEqual({ kind: "codex", command: "codex", model: "gpt-6" })
  })
})

describe("agent arguments", () => {
  it("runs Claude Code headless with a schema and restricted tools", () => {
    expect(buildClaudeArgs(task, "haiku")).toEqual([
      "-p",
      "Find threads",
      "--output-format",
      "json",
      "--json-schema",
      '{"type":"object"}',
      "--no-session-persistence",
      "--allowedTools",
      "a b",
      "--model",
      "haiku",
    ])
  })

  it("appends system instructions after the tools", () => {
    const args = buildClaudeArgs(
      { ...task, appendSystemPrompt: "Answer in JSON" },
      undefined
    )
    expect(args.slice(-2)).toEqual(["--append-system-prompt", "Answer in JSON"])
  })

  it("runs Codex read-only with an output schema file", () => {
    expect(
      buildCodexArgs(task, undefined, {
        schema: "/t/s.json",
        output: "/t/o.json",
      })
    ).toEqual([
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "--output-schema",
      "/t/s.json",
      "--output-last-message",
      "/t/o.json",
      "Find threads",
    ])
  })
})

describe("Codex tasks", () => {
  const files = { schema: "/t/s.json", output: "/t/o.json" }

  it("reads the system instructions after the prompt", () => {
    expect(
      buildCodexArgs(
        { ...task, appendSystemPrompt: "Do not post." },
        undefined,
        files
      ).at(-1)
    ).toBe("Find threads\n\nDo not post.")
  })

  it("opens the sandbox with network for a task that runs commands", () => {
    const args = buildCodexArgs(
      { ...task, sandbox: "workspace-write" },
      undefined,
      files
    )
    expect(args).toContain("workspace-write")
    expect(args).toContain("sandbox_workspace_write.network_access=true")
  })
})

describe("parseClaudeOutput", () => {
  it("returns the structured output, ignoring warnings printed before it", () => {
    expect(
      parseClaudeOutput(
        'Warning: no stdin\n{"is_error":false,"structured_output":{"discussions":[]}}'
      )
    ).toEqual({ discussions: [] })
  })

  it("surfaces agent errors", () => {
    expect(() =>
      parseClaudeOutput('{"is_error":true,"result":"Not logged in"}')
    ).toThrow("Not logged in")
  })
})

describe("agentEnv", () => {
  it("drops the Anthropic API key so Claude Code keeps the claude.ai login", () => {
    expect(agentEnv({ ANTHROPIC_API_KEY: "sk", PATH: "/bin" })).toEqual({
      PATH: "/bin",
    })
  })
})

describe("runAgent", () => {
  it("sends the task input on stdin", async () => {
    // A stand-in agent that prints its stdin, as Claude Code prints its result.
    const dir = mkdtempSync(path.join(tmpdir(), "agent-"))
    const command = path.join(dir, "echo-agent")
    writeFileSync(command, "#!/bin/sh\ncat\n")
    chmodSync(command, 0o755)
    const answer = await runAgent(
      {
        prompt: "ignored",
        schema: {},
        input: '{"structured_output":{"ok":true}}',
      },
      { kind: "claude", command, model: undefined }
    )
    expect(answer).toEqual({ ok: true })
  })
})
