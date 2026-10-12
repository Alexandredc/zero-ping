import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  getAccessibleRepos,
  getAppSettings,
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
import type { Folder } from "@/server/inbox/actions"
import { toast } from "@/components/ui/toast"

/** The UI reads the local database often; GitHub is only polled by the server. */
const LOCAL_REFRESH_MS = 4000

export const inboxQuery = (folder: Folder, repo?: string) =>
  queryOptions({
    queryKey: ["inbox", folder, repo ?? null],
    queryFn: () => getInbox({ data: { folder, repo } }),
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
    mutationFn: (input: { key: string; done: boolean }) =>
      setDone({ data: input }),
    onSuccess: (_, input) => {
      void refresh()
      if (input.done) {
        toast.add({
          title: "Marqué comme traité",
          actionProps: {
            children: "Annuler",
            onClick: () => done.mutate({ key: input.key, done: false }),
          },
        })
      }
    },
    onError: onError("Impossible de marquer comme traité"),
  })

  const snooze = useMutation({
    mutationFn: (input: { key: string; until: Date | null }) =>
      setSnooze({
        data: { key: input.key, until: input.until?.toISOString() ?? null },
      }),
    onSuccess: (_, input) => {
      void refresh()
      if (input.until) {
        toast.add({
          title: "Mis en pause",
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

export const filesQuery = (key: string) =>
  queryOptions({
    queryKey: ["files", key],
    queryFn: () => getItemFiles({ data: { key } }),
    staleTime: 60_000,
  })

/** Toggles a file's viewed state, optimistically, then syncs it to GitHub. */
export function useFileViewed(key: string) {
  const queryClient = useQueryClient()
  type Files = Awaited<ReturnType<typeof getItemFiles>>
  return useMutation({
    mutationFn: (input: {
      pullRequestId: string
      path: string
      viewed: boolean
    }) => setFileViewedState({ data: input }),
    onMutate: (input) => {
      const previous = queryClient.getQueryData<Files>(["files", key])
      queryClient.setQueryData<Files>(
        ["files", key],
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
      queryClient.setQueryData(["files", key], context?.previous)
      toast.add({
        title: "Fichier non synchronisé avec GitHub",
        description: error.message,
        type: "error",
      })
    },
  })
}
