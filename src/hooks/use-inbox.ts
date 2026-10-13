import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  getAccessibleRepos,
  getAppSettings,
  getDailyRecap,
  getDashboardData,
  getItemChecks,
  getItemMergeInfo,
  getTeam,
  postMerge,
  postRerunChecks,
  postRunStandup,
  postStandupToSlack,
  postTakeReview,
  getItemReviewerOptions,
  getIssues,
  getWeek,
  postWorkItemStatus,
  getItemProjectFields,
  getItemUatStatus,
  getItemLinkedIssues,
  getQuiet,
  postSlackRead,
  getMentions,
  getFolderCounts,
  getItemChat,
  getInsights,
  getItemReviewNotice,
  postReviewNotice,
  refreshInsights,
  getSummaryReadState,
  postSummaryRead,
  postQuestion,
  deleteChat,
  getWorkItemConversation,
  postReviewers,
  getInbox,
  getItemConversation,
  getItemFiles,
  getItemSummary,
  getPingCount,
  getRepos,
  getSlack,
  postSlackReply,
  refreshSlack,
  postReply,
  postReview,
  setDone,
  setFileViewedState,
  setPreferences,
  setRepo,
  setSnooze,
  summarizeItem,
  triggerSync,
} from "@/functions/inbox"
import type { Folder, SortOrder } from "@/server/inbox/actions"
import type { StandupKind } from "@/server/recap/standup"
import { toast } from "@/components/ui/toast"

/** The UI reads the local database often; GitHub is only polled by the server. */
const LOCAL_REFRESH_MS = 4000

export const inboxQuery = (
  folder: Folder,
  repo?: string,
  sort: SortOrder = "priority",
  scope: "mine" | "all" = "mine"
) =>
  queryOptions({
    queryKey: ["inbox", folder, repo ?? null, sort, scope],
    queryFn: () => getInbox({ data: { folder, repo, sort, scope } }),
    refetchInterval: LOCAL_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

export const conversationQuery = (key: string) =>
  queryOptions({
    queryKey: ["conversation", key],
    queryFn: () => getItemConversation({ data: { key } }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

export type SlackSubjectInput = {
  kind: "PullRequest" | "Issue"
  title: string
  url: string
}

export const slackQuery = (key: string, subject?: SlackSubjectInput) =>
  queryOptions({
    queryKey: ["slack", key],
    queryFn: () => getSlack({ data: { key, subject } }),
    // Polls while the agent searches, then relies on the cache.
    refetchInterval: (query) =>
      query.state.data?.lookup?.status === "pending" ? 3000 : false,
  })

export function useRefreshSlack(key: string, subject?: SlackSubjectInput) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshSlack({ data: { key, subject } }),
    onSuccess: (data) => queryClient.setQueryData(["slack", key], data),
  })
}

/** Marks a Slack thread read (collapsed) or unread, showing the change at once. */
export function useSlackRead(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { permalink: string; readThrough: string | null }) =>
      postSlackRead({ data: input }),
    onMutate: (input) => {
      const queryKey = slackQuery(key).queryKey
      const previous = queryClient.getQueryData(queryKey)
      if (previous?.enabled) {
        const reads = { ...previous.reads }
        if (input.readThrough === null) delete reads[input.permalink]
        else reads[input.permalink] = input.readThrough
        queryClient.setQueryData(queryKey, { ...previous, reads })
      }
      return { previous }
    },
    onError: (error, _, context) => {
      if (context?.previous)
        queryClient.setQueryData(slackQuery(key).queryKey, context.previous)
      toast.add({
        title: "Fil non modifié",
        description: error.message,
        type: "error",
      })
    },
  })
}

export function useSlackReply(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { permalink: string; message: string }) =>
      postSlackReply({ data: { key, ...input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["slack", key] })
      toast.add({ title: "Réponse envoyée sur Slack", type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: "Réponse Slack non envoyée",
        description: error.message,
        type: "error",
      }),
  })
}

export const reposQuery = () =>
  queryOptions({
    queryKey: ["repos"],
    queryFn: () => getRepos(),
    refetchInterval: 15_000,
  })

export const accessibleReposQuery = () =>
  queryOptions({
    queryKey: ["accessible-repos"],
    queryFn: () => getAccessibleRepos(),
    staleTime: 10 * 60_000,
  })

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inconnue"
}

export function useInboxActions() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inbox"] })
  const onError = (title: string) => (error: unknown) =>
    toast.add({ title, description: errorMessage(error), type: "error" })

  const done = useMutation({
    mutationFn: (input: { keys: string[]; done: boolean }) =>
      setDone({ data: input }),
    onSuccess: (_, input) => {
      void refresh()
      if (input.done) {
        toast.add({
          title:
            input.keys.length > 1
              ? `${input.keys.length} éléments marqués comme traités`
              : "Marqué comme traité",
          description:
            "Rangé dans « Traités » et marqué Done sur GitHub. Il revient tout seul s'il y a du nouveau.",
          actionProps: {
            children: "Annuler",
            onClick: () => done.mutate({ keys: input.keys, done: false }),
          },
        })
      }
    },
    onError: onError("Impossible de marquer comme traité"),
  })

  const snooze = useMutation({
    mutationFn: (input: { keys: string[]; until: Date | null }) =>
      setSnooze({
        data: { keys: input.keys, until: input.until?.toISOString() ?? null },
      }),
    onSuccess: (_, input) => {
      void refresh()
      if (input.until) {
        toast.add({
          title:
            input.keys.length > 1
              ? `${input.keys.length} éléments mis en pause`
              : "Mis en pause",
          description: `Jusqu'au ${input.until.toLocaleString("fr", { weekday: "long", hour: "2-digit", minute: "2-digit" })}`,
        })
      }
    },
    onError: onError("Impossible de mettre en pause"),
  })

  const reply = useMutation({
    mutationFn: (input: Parameters<typeof postReply>[0]["data"]) =>
      postReply({ data: input }),
    onSuccess: (_, input) => {
      void refresh()
      void queryClient.invalidateQueries({
        queryKey: ["conversation", input.key],
      })
      toast.add({ title: "Réponse envoyée", type: "success" })
    },
    onError: onError("Réponse non envoyée"),
  })

  const review = useMutation({
    mutationFn: (input: Parameters<typeof postReview>[0]["data"]) =>
      postReview({ data: input }),
    onSuccess: (_, input) => {
      void refresh()
      void queryClient.invalidateQueries({
        queryKey: ["conversation", input.key],
      })
      const titles = {
        APPROVE: "PR approuvée",
        REQUEST_CHANGES: "Changements demandés",
        COMMENT: "Review envoyée",
      }
      toast.add({ title: titles[input.event], type: "success" })
    },
    onError: onError("Review non envoyée"),
  })

  const sync = useMutation({
    mutationFn: () => triggerSync(),
    onSuccess: () => refresh(),
    onError: onError("Synchronisation échouée"),
  })

  const trackRepo = useMutation({
    mutationFn: (input: { fullName: string; tracked: boolean }) =>
      setRepo({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["repos"] })
      void refresh()
    },
    onError: onError("Impossible de modifier le repo"),
  })

  return { done, snooze, reply, review, sync, trackRepo }
}

export const settingsQuery = () =>
  queryOptions({ queryKey: ["settings"], queryFn: () => getAppSettings() })

export function useSavePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Parameters<typeof setPreferences>[0]["data"]) =>
      setPreferences({ data: patch }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] })
      void queryClient.invalidateQueries({ queryKey: ["quiet"] })
      void queryClient.invalidateQueries({ queryKey: ["slack"] })
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
      void queryClient.invalidateQueries({ queryKey: ["issues"] })
      toast.add({ title: "Réglage enregistré" })
    },
    onError: (error) =>
      toast.add({
        title: "Réglage non enregistré",
        description: error.message,
        type: "error",
      }),
  })
}

export const summaryQuery = (key: string) =>
  queryOptions({
    queryKey: ["summary", key],
    queryFn: () => getItemSummary({ data: { key } }),
    // A summary started before a reload keeps being polled until it lands.
    refetchInterval: (query) =>
      query.state.data?.generating.length ? 3000 : false,
  })

export function useSummarize(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (length: "short" | "standard" | "detailed") =>
      summarizeItem({ data: { key, length } }),
    onSuccess: (data) => queryClient.setQueryData(["summary", key], data),
    onError: (error) =>
      toast.add({
        title: "Résumé impossible",
        description: error.message,
        type: "error",
      }),
  })
}

/** Items waiting for the viewer, refreshed like the inbox. */
/** Folder counts for the sidebar on pages that do not load the inbox. */
export const folderCountsQuery = () =>
  queryOptions({
    queryKey: ["inbox", "counts"],
    queryFn: () => getFolderCounts(),
    refetchInterval: LOCAL_REFRESH_MS,
  })

export const pingCountQuery = () =>
  queryOptions({
    queryKey: ["inbox", "pings"],
    queryFn: () => getPingCount(),
    refetchInterval: LOCAL_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

export const filesQuery = (key: string, sinceReview = false) =>
  queryOptions({
    queryKey: ["files", key, sinceReview],
    queryFn: () => getItemFiles({ data: { key, sinceReview } }),
    staleTime: 60_000,
  })

/** Toggles a file's viewed state, optimistically, then syncs it to GitHub. */
export function useFileViewed(key: string, sinceReview = false) {
  const queryClient = useQueryClient()
  type Files = Awaited<ReturnType<typeof getItemFiles>>
  return useMutation({
    mutationFn: (input: {
      pullRequestId: string
      path: string
      viewed: boolean
    }) => setFileViewedState({ data: input }),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<Files>([
        "files",
        key,
        sinceReview,
      ])
      queryClient.setQueryData<Files>(
        ["files", key, sinceReview],
        (data) =>
          data && {
            ...data,
            files: data.files.map((file) =>
              file.filename === input.path
                ? { ...file, viewed: input.viewed ? "VIEWED" : "UNVIEWED" }
                : file
            ),
          }
      )
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(["files", key, sinceReview], context?.previous)
      toast.add({
        title: "Fichier non synchronisé avec GitHub",
        description: error.message,
        type: "error",
      })
    },
  })
}

export const mergeInfoQuery = (key: string) =>
  queryOptions({
    queryKey: ["merge-info", key],
    queryFn: () => getItemMergeInfo({ data: { key } }),
    staleTime: 10_000,
  })

export function useMerge(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      method: "SQUASH" | "MERGE" | "REBASE"
      deleteBranch: boolean
    }) => postMerge({ data: { key, ...input } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
      void queryClient.invalidateQueries({ queryKey: ["merge-info", key] })
      toast.add({
        title: "PR mergée",
        description: result.deletedBranch
          ? `Branche ${result.deletedBranch} supprimée.`
          : undefined,
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Merge impossible",
        description: error.message,
        type: "error",
      }),
  })
}

export const checksQuery = (key: string) =>
  queryOptions({
    queryKey: ["checks", key],
    queryFn: () => getItemChecks({ data: { key } }),
    staleTime: 15_000,
  })

export function useRerunChecks(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => postRerunChecks({ data: { key } }),
    onSuccess: ({ runs }) => {
      setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: ["checks", key] }),
        5000
      )
      toast.add({
        title: "Jobs en échec relancés",
        description: `${runs} workflow${runs > 1 ? "s" : ""} relancé${runs > 1 ? "s" : ""} sur GitHub Actions.`,
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Relance impossible",
        description: error.message,
        type: "error",
      }),
  })
}

export const teamQuery = () =>
  queryOptions({
    queryKey: ["team"],
    queryFn: () => getTeam(),
    refetchInterval: 30_000,
  })

export function useTakeReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => postTakeReview({ data: { key } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
      toast.add({
        title: "Review prise",
        description: "La PR arrive dans « À reviewer » à la prochaine synchro.",
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Impossible de prendre la review",
        description: error.message,
        type: "error",
      }),
  })
}

export const reviewerOptionsQuery = (key: string) =>
  queryOptions({
    queryKey: ["reviewer-options", key],
    queryFn: () => getItemReviewerOptions({ data: { key } }),
    staleTime: 30_000,
  })

export function useSetReviewers(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewers: string[]) =>
      postReviewers({ data: { key, reviewers } }),
    onSuccess: ({ add, remove }) => {
      void queryClient.invalidateQueries({ queryKey: ["team"] })
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
      void queryClient.invalidateQueries({
        queryKey: ["reviewer-options", key],
      })
      const parts = [
        add.length > 0 && `${add.length} demandé${add.length > 1 ? "s" : ""}`,
        remove.length > 0 &&
          `${remove.length} retiré${remove.length > 1 ? "s" : ""}`,
      ].filter(Boolean)
      toast.add({
        title: "Reviewers mis à jour",
        description:
          parts.length > 0 ? `${parts.join(", ")} sur GitHub.` : undefined,
        type: "success",
      })
    },
    onError: (error) =>
      toast.add({
        title: "Impossible de changer les reviewers",
        description: error.message,
        type: "error",
      }),
  })
}

export const workConversationQuery = (
  key: string,
  kind: "Issue" | "PullRequest"
) =>
  queryOptions({
    queryKey: ["work-conversation", key],
    queryFn: () => getWorkItemConversation({ data: { key, kind } }),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

export const projectFieldsQuery = (key: string) =>
  queryOptions({
    queryKey: ["project-fields", key],
    queryFn: () => getItemProjectFields({ data: { key } }),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })

export const quietQuery = () =>
  queryOptions({
    queryKey: ["quiet"],
    queryFn: () => getQuiet(),
    staleTime: 30_000,
    // A « Ne pas déranger » that ends on its own shows up without a reload.
    refetchInterval: 60_000,
  })

export const linkedIssuesQuery = (key: string) =>
  queryOptions({
    queryKey: ["linked-issues", key],
    queryFn: () => getItemLinkedIssues({ data: { key } }),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })

export const uatStatusQuery = (key: string) =>
  queryOptions({
    queryKey: ["uat", key],
    queryFn: () => getItemUatStatus({ data: { key } }),
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  })

/** Sets the status or priority of an item's card, showing it before GitHub answers. */
export function useSetProjectField(key: string) {
  const queryClient = useQueryClient()
  const queryKey = projectFieldsQuery(key).queryKey
  return useMutation({
    mutationFn: (input: {
      projectId: string
      itemId: string
      fieldId: string
      optionId: string
      field: "status" | "priority"
      value: string
    }) =>
      postWorkItemStatus({
        data: {
          projectId: input.projectId,
          itemId: input.itemId,
          fieldId: input.fieldId,
          optionId: input.optionId,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      if (previous)
        queryClient.setQueryData(queryKey, {
          ...previous,
          [input.field]: input.value,
        })
      return { previous }
    },
    onError: (error, _, context) => {
      if (context?.previous)
        queryClient.setQueryData(queryKey, context.previous)
      toast.add({
        title: "Champ du projet non modifié",
        description: error.message,
        type: "error",
      })
    },
    onSuccess: (_, input) =>
      toast.add({
        title:
          input.field === "status"
            ? `Déplacée dans « ${input.value} »`
            : `Priorité passée à ${input.value}`,
        type: "success",
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: ["issues"] })
    },
  })
}

/** Moves an item to another board column, showing the new status before GitHub answers. */
export function useSetWorkItemStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      projectId: string
      itemId: string
      fieldId: string
      optionId: string
      status: string
    }) =>
      postWorkItemStatus({
        data: {
          projectId: input.projectId,
          itemId: input.itemId,
          fieldId: input.fieldId,
          optionId: input.optionId,
        },
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["issues"] })
      const previous = queryClient.getQueryData(issuesQuery().queryKey)
      if (previous) {
        const move = <
          T extends { projectItemId: string | null; status: string | null },
        >(
          item: T
        ) =>
          item.projectItemId === input.itemId
            ? { ...item, status: input.status }
            : item
        queryClient.setQueryData(issuesQuery().queryKey, {
          ...previous,
          assigned: previous.assigned.map(move),
          sprint: previous.sprint && {
            ...previous.sprint,
            items: previous.sprint.items.map(move),
          },
        })
      }
      return { previous }
    },
    onError: (error, _, context) => {
      if (context?.previous)
        queryClient.setQueryData(issuesQuery().queryKey, context.previous)
      toast.add({
        title: "Statut non modifié",
        description: error.message,
        type: "error",
      })
    },
    onSuccess: (_, input) =>
      toast.add({
        title: `Déplacée dans « ${input.status} »`,
        type: "success",
      }),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ["issues"] }),
  })
}

export const mentionsQuery = (repo: string) =>
  queryOptions({
    queryKey: ["mentions", repo],
    queryFn: () => getMentions({ data: { repo } }),
    staleTime: 10 * 60_000,
  })

export const reviewNoticeQuery = (
  key: string,
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
) =>
  queryOptions({
    queryKey: ["review-notice", key, event],
    queryFn: () => getItemReviewNotice({ data: { key, event } }),
    staleTime: Infinity,
  })

export function useSendReviewNotice() {
  return useMutation({
    mutationFn: (input: Parameters<typeof postReviewNotice>[0]["data"]) =>
      postReviewNotice({ data: input }),
    onSuccess: ({ permalink }) =>
      toast.add({
        title: "Message posté sur Slack",
        description: permalink ?? undefined,
        type: "success",
      }),
    onError: (error) =>
      toast.add({
        title: "Message Slack non envoyé",
        description: error.message,
        type: "error",
      }),
  })
}

export const insightsQuery = (key: string, subject?: SlackSubjectInput) =>
  queryOptions({
    queryKey: ["insights", key],
    queryFn: () => getInsights({ data: { key, subject } }),
    // The server keeps them 20 min too; ↻ asks again.
    staleTime: 20 * 60_000,
  })

export function useRefreshInsights(key: string, subject?: SlackSubjectInput) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshInsights({ data: { key, subject } }),
    onSuccess: (data) =>
      queryClient.setQueryData(insightsQuery(key).queryKey, data),
    onError: (error) =>
      toast.add({
        title: "KPI Jev indisponibles",
        description: error.message,
        type: "error",
      }),
  })
}

export const summaryReadQuery = (key: string) =>
  queryOptions({
    queryKey: ["summary-read", key],
    queryFn: () => getSummaryReadState({ data: { key } }),
  })

export function useSummaryRead(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (read: boolean) => postSummaryRead({ data: { key, read } }),
    onMutate: (read) =>
      queryClient.setQueryData(summaryReadQuery(key).queryKey, {
        readAt: read ? new Date() : null,
      }),
    onSettled: () =>
      void queryClient.invalidateQueries({
        queryKey: summaryReadQuery(key).queryKey,
      }),
  })
}

export const chatQuery = (key: string) =>
  queryOptions({
    queryKey: ["chat", key],
    queryFn: () => getItemChat({ data: { key } }),
  })

/** Asks Claude about an item; the question shows at once, the answer when it lands. */
export function useAskAi(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (question: string) => postQuestion({ data: { key, question } }),
    onSuccess: (chat) =>
      queryClient.setQueryData(chatQuery(key).queryKey, chat),
    onError: (error) =>
      toast.add({
        title: "L'IA n'a pas répondu",
        description: error.message,
        type: "error",
      }),
  })
}

export function useClearChat(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteChat({ data: { key } }),
    onSuccess: (chat) =>
      queryClient.setQueryData(chatQuery(key).queryKey, chat),
  })
}

export const weekQuery = () =>
  queryOptions({
    queryKey: ["week"],
    queryFn: () => getWeek(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

export const issuesQuery = () =>
  queryOptions({
    queryKey: ["issues"],
    queryFn: () => getIssues(),
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
  })

export const recapQuery = () =>
  queryOptions({
    queryKey: ["recap"],
    queryFn: () => getDailyRecap(),
    // Polls faster while the standup runs.
    refetchInterval: (query) =>
      query.state.data &&
      Object.values(query.state.data.standups).some(
        (standup) => standup.state.status === "running"
      )
        ? 5000
        : 30_000,
  })

export function useRunStandup(kind: StandupKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => postRunStandup({ data: { kind } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["recap"] }),
    onError: (error) =>
      toast.add({
        title: "Standup non lancé",
        description: error.message,
        type: "error",
      }),
  })
}

export const dashboardQuery = () =>
  queryOptions({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardData(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

export function usePublishStandup(kind: StandupKind) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => postStandupToSlack({ data: { kind } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recap"] })
      toast.add({ title: "Standup publié dans Slack", type: "success" })
    },
    onError: (error) =>
      toast.add({
        title: "Standup non publié",
        description: error.message,
        type: "error",
      }),
  })
}
