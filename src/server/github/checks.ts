import type { Octokit } from "octokit"

export type FailedCheck = {
  name: string
  /** Job page with its log for GitHub Actions, the CI's page otherwise. */
  url: string | null
  conclusion: string
  /** Short reason shown by the check, when it gives one. */
  summary: string | null
  /** Workflow run the check belongs to; null for external CI, which cannot be re-run here. */
  runId: number | null
}

export type CheckState = "passed" | "failed" | "pending" | "skipped"

/** Every check of the head commit, as GitHub's merge box counts them. */
export type ChecksSummary = Record<CheckState, number> & {
  /** Names of the checks still running, to say what is awaited. */
  running: string[]
}

export type PullChecks = {
  headSha: string
  summary: ChecksSummary
  failed: FailedCheck[]
  /** Failed GitHub Actions runs whose failed jobs can be re-run. */
  rerunnableRuns: number[]
}

type Ref = { owner: string; repo: string; number: number }

const FAILED = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required",
  "startup_failure",
])

/** One check run (`status`, `conclusion`) or commit status (`state`), in four states. */
export function checkState(
  check:
    | { kind: "run"; status: string; conclusion: string | null }
    | { kind: "status"; state: string }
): CheckState {
  if (check.kind === "status")
    return check.state === "success"
      ? "passed"
      : check.state === "pending"
        ? "pending"
        : "failed"
  if (check.status !== "completed" || !check.conclusion) return "pending"
  if (FAILED.has(check.conclusion)) return "failed"
  return check.conclusion === "skipped" ? "skipped" : "passed"
}

export function summarizeChecks(
  checks: { name: string; state: CheckState }[]
): ChecksSummary {
  const summary: ChecksSummary = {
    passed: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    running: [],
  }
  for (const check of checks) {
    summary[check.state] += 1
    if (check.state === "pending") summary.running.push(check.name)
  }
  return summary
}

const RUN_URL = /\/actions\/runs\/(\d+)/

export function runIdFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(RUN_URL)
  return match ? Number(match[1]) : null
}

export async function fetchChecks(
  octokit: Octokit,
  ref: Ref
): Promise<PullChecks> {
  const { data: pull } = await octokit.rest.pulls.get({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.number,
  })
  const headSha = pull.head.sha
  const [runs, statuses] = await Promise.all([
    octokit.paginate(octokit.rest.checks.listForRef, {
      owner: ref.owner,
      repo: ref.repo,
      ref: headSha,
      filter: "latest",
      per_page: 100,
    }),
    octokit.rest.repos
      .getCombinedStatusForRef({
        owner: ref.owner,
        repo: ref.repo,
        ref: headSha,
      })
      .then((response) => response.data.statuses),
  ])

  const failed: FailedCheck[] = [
    ...runs
      .filter((run) => run.conclusion && FAILED.has(run.conclusion))
      .map((run) => {
        const isActions = run.app?.slug === "github-actions"
        return {
          name: run.name,
          url: run.html_url ?? run.details_url ?? null,
          conclusion: run.conclusion ?? "failure",
          summary: run.output.title ?? null,
          runId: isActions
            ? runIdFromUrl(run.details_url ?? run.html_url)
            : null,
        }
      }),
    ...statuses
      .filter(
        (status) => status.state === "failure" || status.state === "error"
      )
      .map((status) => ({
        name: status.context,
        url: status.target_url ?? null,
        conclusion: status.state,
        summary: status.description ?? null,
        runId: null,
      })),
  ]
  return {
    headSha,
    summary: summarizeChecks([
      ...runs.map((run) => ({
        name: run.name,
        state: checkState({
          kind: "run",
          status: run.status,
          conclusion: run.conclusion,
        }),
      })),
      ...statuses.map((status) => ({
        name: status.context,
        state: checkState({ kind: "status", state: status.state }),
      })),
    ]),
    failed,
    rerunnableRuns: [
      ...new Set(failed.flatMap((check) => (check.runId ? [check.runId] : []))),
    ],
  }
}

/** Re-runs only the failed jobs of each failed workflow run. */
export async function rerunFailedJobs(
  octokit: Octokit,
  ref: Ref
): Promise<number> {
  const { rerunnableRuns } = await fetchChecks(octokit, ref)
  if (rerunnableRuns.length === 0)
    throw new Error(
      "Aucun job GitHub Actions à relancer : la CI en échec est externe."
    )
  await Promise.all(
    rerunnableRuns.map((runId) =>
      octokit.rest.actions.reRunWorkflowFailedJobs({
        owner: ref.owner,
        repo: ref.repo,
        run_id: runId,
      })
    )
  )
  return rerunnableRuns.length
}
