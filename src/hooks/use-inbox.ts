import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  getAccessibleRepos,
  getAppSettings,
  getDailyRecap,
  getItemChecks,
  getItemMergeInfo,
  getTeam,
  postMerge,
  postRerunChecks,
  postRunStandup,
  postTakeReview,
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
import { toast } from "@/components/ui/toast"

/** The UI reads the local database often; GitHub is only polled by the server. */
const LOCAL_REFRESH_MS = 4000

export const inboxQuery = (
  folder: Folder,
  repo?: string,
  sort: SortOrder = "priority"
) =>
  queryOptions({
    queryKey: ["inbox", folder, repo ?? null, sort],
    queryFn: () => getInbox({ data: { folder, repo, sort } }),
    refetchInterval: LOCAL_REFRESH_MS,
    refetchOnWindowFocus: true,
  })

export const conversationQuery = (key: string) =>
  queryOptions({
    queryKey: ["conversation", key],
    queryFn: () => getItemConversation({ data: { key } }),
    staleTime: 30_000,
  })

export const slackQuery = (key: string) =>
  queryOptions({
    queryKey: ["slack", key],
    queryFn: () => getSlack({ data: { key } }),
    // Polls while the agent searches, then relies on the cache.
    refetchInterval: (query) =>
      query.state.data?.lookup?.status === "pending" ? 3000 : false,
  })

export function useRefreshSlack(key: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshSlack({ data: { key } }),
    onSuccess: (data) => queryClient.setQueryData(["slack", key], data),
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
      void queryClient.invalidateQueries({ queryKey: ["slack"] })
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
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

export const recapQuery = () =>
  queryOptions({
    queryKey: ["recap"],
    queryFn: () => getDailyRecap(),
    // Polls faster while the standup runs.
    refetchInterval: (query) =>
      query.state.data?.standup.status === "running" ? 5000 : 30_000,
  })

export function useRunStandup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => postRunStandup(),
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
