import type { Viewer } from "@/server/inbox/analyze"

/**
 * Demo mode (`pnpm demo`): fictional data in its own data folder, and nothing
 * leaves the machine. Every guard of the live code checks this one switch.
 */
export function isDemo(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO === "1"
}

/** Kept apart from `.data/pglite`, which the demo never opens. */
export const DEMO_DATA_DIR = ".data/demo"

export const DEMO_VIEWER: Viewer = {
  login: "jane-doe",
  teams: ["acme/web-team", "acme/backend"],
}

export const DEMO_OFFLINE =
  "Mode démo : rien n'est envoyé à GitHub, à Slack ni à l'IA."

/** Thrown by every live call that would reach GitHub, Slack or an AI. */
export class DemoOfflineError extends Error {
  constructor() {
    super(DEMO_OFFLINE)
    this.name = "DemoOfflineError"
  }
}
