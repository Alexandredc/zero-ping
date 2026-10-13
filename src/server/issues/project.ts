import { eq } from "drizzle-orm"
import type { Octokit } from "octokit"
import { getDb } from "@/server/db/client"
import { repos } from "@/server/db/schema"
import { getOctokit, getViewer } from "@/server/github/client"
import { getPreferences } from "@/server/preferences"
import { fetchSprintBoard, listSprintProjects } from "./sprint"
import { fetchProjectFieldsBatch } from "./project-fields"
import type { SprintProjectRef } from "./sprint"

const PROJECTS_TTL_MS = 10 * 60 * 1000
let projectsCache: { at: number; projects: SprintProjectRef[] } | null = null

/** Projects with a sprint, among the owners of the tracked repos and the viewer's own. */
export async function sprintProjects(): Promise<SprintProjectRef[]> {
  if (projectsCache && Date.now() - projectsCache.at < PROJECTS_TTL_MS)
    return projectsCache.projects
  const db = await getDb()
  const [octokit, viewer, tracked] = await Promise.all([
    getOctokit(),
    getViewer(),
    db.select().from(repos).where(eq(repos.tracked, true)),
  ])
  const owners = [
    ...new Set([
      ...tracked.map((repo) => repo.fullName.split("/")[0]),
      viewer.login,
    ]),
  ]
  const projects = await listSprintProjects(octokit, owners)
  projectsCache = { at: Date.now(), projects }
  return projects
}

/** The project chosen in the settings, else the first one with a sprint. */
export function pickSprintProject(
  projects: SprintProjectRef[],
  preference: string | null
): SprintProjectRef | null {
  return (
    projects.find((p) => `${p.owner}/${p.number}` === preference) ??
    projects.at(0) ??
    null
  )
}

let boardCache: {
  at: number
  ref: string
  board: Awaited<ReturnType<typeof fetchSprintBoard>>
} | null = null

/** The sprint project's board fields, cached like the project list. */
export async function sprintBoard(octokit: Octokit, project: SprintProjectRef) {
  const ref = `${project.owner}/${project.number}`
  if (
    boardCache &&
    boardCache.ref === ref &&
    Date.now() - boardCache.at < PROJECTS_TTL_MS
  )
    return boardCache.board
  const board = await fetchSprintBoard(octokit, project)
  boardCache = { at: Date.now(), ref, board }
  return board
}

/** The team's sprint project and its board, or null when no project has a sprint. */
export async function currentSprintProject(octokit: Octokit) {
  const [preferences, projects] = await Promise.all([
    getPreferences(await getDb()),
    sprintProjects(),
  ])
  const project = pickSprintProject(projects, preferences.sprintProject)
  return project
    ? { project, board: await sprintBoard(octokit, project) }
    : null
}

const PRIORITY_TTL_MS = 10 * 60 * 1000
const priorities = new Map<string, { at: number; priority: string | null }>()

/**
 * The priority each item's card carries on the sprint project, read in
 * batches and kept ten minutes, for Jev to weigh. Items off the board get null.
 */
export async function projectPriorities(
  octokit: Octokit,
  keys: string[]
): Promise<Map<string, string | null>> {
  const now = Date.now()
  const missing = keys.filter((key) => {
    const known = priorities.get(key)
    return !known || now - known.at >= PRIORITY_TTL_MS
  })
  if (missing.length > 0) {
    try {
      const sprint = await currentSprintProject(octokit)
      if (sprint?.board.priorityField) {
        const fields = await fetchProjectFieldsBatch(
          octokit,
          missing,
          sprint.project,
          { status: "Status", priority: sprint.board.priorityField.name }
        )
        for (const key of missing)
          priorities.set(key, {
            at: now,
            priority: fields.get(key)?.priority ?? null,
          })
      }
    } catch (error) {
      // Without the board, Jev ranks on the item alone.
      console.error("[priorities]", error)
    }
  }
  return new Map(
    keys.map((key) => [key, priorities.get(key)?.priority ?? null])
  )
}
