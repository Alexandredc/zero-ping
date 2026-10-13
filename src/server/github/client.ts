import "@/server/env"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Octokit } from "octokit"
import type { Viewer } from "@/server/inbox/analyze"
import { DEMO_VIEWER, DemoOfflineError, isDemo } from "@/server/demo/mode"

const execFileAsync = promisify(execFile)

/** Uses GITHUB_TOKEN when set, otherwise the token of the local `gh` CLI. */
async function resolveToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"])
    return stdout.trim()
  } catch {
    throw new Error(
      "Aucun token GitHub : lance `gh auth login` ou définis GITHUB_TOKEN."
    )
  }
}

const globalForGithub = globalThis as unknown as {
  __githubInboxOctokit?: Promise<Octokit>
  __githubInboxViewer?: Promise<Viewer>
}

export function getOctokit(): Promise<Octokit> {
  if (isDemo()) return Promise.reject(new DemoOfflineError())
  globalForGithub.__githubInboxOctokit ??= resolveToken().then(
    (auth) => new Octokit({ auth, userAgent: "github-management" })
  )
  return globalForGithub.__githubInboxOctokit
}

export function getViewer(): Promise<Viewer> {
  if (isDemo()) return Promise.resolve(DEMO_VIEWER)
  globalForGithub.__githubInboxViewer ??= (async () => {
    const octokit = await getOctokit()
    const [{ data: user }, teams] = await Promise.all([
      octokit.rest.users.getAuthenticated(),
      octokit.paginate(octokit.rest.teams.listForAuthenticatedUser, {
        per_page: 100,
      }),
    ])
    return {
      login: user.login,
      teams: teams.map((team) => `${team.organization.login}/${team.slug}`),
    }
  })().catch((error: unknown) => {
    globalForGithub.__githubInboxViewer = undefined
    throw error
  })
  return globalForGithub.__githubInboxViewer
}
