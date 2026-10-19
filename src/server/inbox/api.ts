import * as live from "@/server/inbox/actions"
import * as loop from "@/server/inbox/loop"
import { demoActions, ensureDemoSeed } from "@/server/demo/actions"
import { isDemo } from "@/server/demo/mode"

/**
 * What the server functions call: the live actions, or in demo mode the same
 * ones over the seeded database, with the demo's stand-ins for everything that
 * would reach GitHub, Slack or an AI.
 */
function demo<T extends Record<string, unknown>>(actions: T): T {
  return Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [
      name,
      typeof action === "function"
        ? async (...args: unknown[]) => {
            await ensureDemoSeed()
            return (action as (...a: unknown[]) => unknown)(...args)
          }
        : action,
    ])
  ) as T
}

const actions = isDemo() ? demo<typeof live>({ ...live, ...demoActions }) : live

const demoSync = {
  ensureSyncLoop: () => {},
  syncNow: () => Promise.resolve(),
  getSyncStatus: (): loop.SyncStatus => ({
    running: false,
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    nextSyncAt: null,
    githubIntervalS: 60,
    teamSyncedAt: new Date().toISOString(),
  }),
}
const sync = isDemo() ? demoSync : loop

export const {
  askAboutItem,
  clearChat,
  countBrowse,
  countFolders,
  countPings,
  countTeamProblems,
  generateSummary,
  getAttention,
  getChat,
  getChecks,
  getConversation,
  getDashboard,
  getLinkedIssues,
  getMentionCandidates,
  getMergeInfo,
  getProjectFields,
  getPullFiles,
  getPullInsights,
  getQuietState,
  getRecap,
  getReviewNotice,
  getReviewerOptions,
  getSettings,
  getSlackDiscussions,
  getSummary,
  getSummaryRead,
  getUatStatus,
  getWeekSummary,
  getWorkConversation,
  listAccessibleRepos,
  listAllIssues,
  listAllPulls,
  listInbox,
  listIssues,
  listRepos,
  listTeam,
  markDone,
  markFileViewed,
  merge,
  moveWorkItem,
  postStandup,
  replyInSlack,
  reply,
  rerunChecks,
  runStandup,
  savePreferences,
  searchItems,
  sendReviewNotice,
  setRepoTracked,
  setReviewers,
  setSlackRead,
  setSummaryRead,
  snooze,
  submitReview,
  takeReview,
} = actions

export const { ensureSyncLoop, getSyncStatus, syncNow } = sync
