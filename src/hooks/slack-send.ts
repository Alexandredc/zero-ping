import type { toast } from "@/components/ui/toast"

export type Toasts = Pick<typeof toast, "add" | "close">

export type SlackSendCopy = {
  /** Shown while the agent sends, when nothing else on screen tells it. */
  sending?: string
  sent: string
  failed: string
  openInSlack: string
  retry: string
  unknownError: string
}

/**
 * The toasts of a Slack message sent in the background: the agent takes up to
 * two minutes, so the UI hands control back at once and reports here. A
 * failure stays on screen with « Réessayer », which sends the same text again.
 */
export function slackSendToasts(toasts: Toasts, copy: SlackSendCopy) {
  return {
    /** The id of the loading toast to pass back to `sent` or `failed`. */
    started: (): string | undefined =>
      copy.sending
        ? toasts.add({ title: copy.sending, type: "loading", timeout: 0 })
        : undefined,
    sent: (permalink: string | null, pending?: string) => {
      if (pending) toasts.close(pending)
      toasts.add({
        title: copy.sent,
        type: "success",
        actionProps: permalink
          ? {
              children: copy.openInSlack,
              onClick: () =>
                window.open(permalink, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      })
    },
    failed: (error: unknown, retry: () => void, pending?: string) => {
      if (pending) toasts.close(pending)
      const id = toasts.add({
        title: copy.failed,
        description:
          error instanceof Error && error.message
            ? error.message
            : copy.unknownError,
        type: "error",
        priority: "high",
        // The message only lives in this toast now: it waits for the user.
        timeout: 0,
        actionProps: {
          children: copy.retry,
          onClick: () => {
            toasts.close(id)
            retry()
          },
        },
      })
    },
  }
}
