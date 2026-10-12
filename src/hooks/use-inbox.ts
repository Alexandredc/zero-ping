import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  getAccessibleRepos,
  getInbox,
  getItemConversation,
  getRepos,
  postReply,
  postReview,
  setDone,
  setRepo,
  setSnooze,
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
