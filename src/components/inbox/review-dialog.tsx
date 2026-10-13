import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { CheckIcon, MessageSquareWarningIcon } from "lucide-react"
import { SlackIcon } from "@/components/brand-icons"
import {
  reviewNoticeQuery,
  useInboxActions,
  useSendReviewNotice,
} from "@/hooks/use-inbox"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES"

export type PendingReview = {
  key: string
  event: ReviewEvent
  /** The comment typed in the panel, sent with the review. */
  body: string
  /** Empties the panel's comment box once the review is sent. */
  onSent: () => void
}

const COPY: Record<
  ReviewEvent,
  { title: string; action: string; description: string }
> = {
  APPROVE: {
    title: "Approuver la PR ?",
    action: "Approuver",
    description: "La review « Approve » part sur GitHub en ton nom.",
  },
  REQUEST_CHANGES: {
    title: "Demander des changements ?",
    action: "Demander des changements",
    description:
      "La review « Changes requested » part sur GitHub en ton nom : la PR ne pourra plus être mergée sans nouvelle approbation.",
  },
}

/**
 * Confirms a review before it leaves, and offers in the same step the Slack
 * message that pings the author. The page owns it: an approved PR leaves its
 * folder and closes the panel, which must not cut the sending short.
 */
export function ReviewDialog({
  review,
  onClose,
}: {
  review: PendingReview
  onClose: () => void
}) {
  const actions = useInboxActions()
  const send = useSendReviewNotice()
  const { data: notice } = useQuery(reviewNoticeQuery(review.key, review.event))
  // An approval rarely needs a ping: the message is offered, not sent by default.
  const [notify, setNotify] = useState(review.event !== "APPROVE")
  const [message, setMessage] = useState("")
  const ready = notice?.enabled ? notice : null
  const copy = COPY[review.event]

  useEffect(() => {
    if (notice?.enabled) setMessage(notice.message)
  }, [notice])

  const busy = actions.review.isPending || send.isPending
  const willNotify = Boolean(ready && notify && message.trim())

  const confirm = async () => {
    await actions.review.mutateAsync({
      key: review.key,
      event: review.event,
      body: review.body,
    })
    review.onSent()
    if (ready && willNotify)
      await send.mutateAsync({
        message,
        threadPermalink: ready.threadPermalink,
        // Only the people still named in the message get pinged.
        mentions:
          ready.author && message.includes(`@${ready.author.login}`)
            ? [ready.author]
            : [],
      })
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {review.body.trim() && (
          <blockquote className="line-clamp-4 border-l-2 pl-3 text-sm text-muted-foreground">
            {review.body}
          </blockquote>
        )}

        {notice === undefined && <Skeleton className="h-28 w-full" />}
        {ready && (
          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <Field orientation="horizontal">
              <Checkbox
                id="review-notify"
                checked={notify}
                onCheckedChange={setNotify}
                disabled={busy}
              />
              <FieldContent>
                <FieldLabel
                  htmlFor="review-notify"
                  className="flex items-center gap-1.5"
                >
                  <SlackIcon className="size-3.5" aria-hidden />
                  Prévenir l'auteur sur Slack
                </FieldLabel>
                <FieldDescription>
                  {ready.threadPermalink
                    ? `En réponse dans le fil de la PR sur #${ready.channel}.`
                    : `Nouveau message dans #${ready.channel}.`}
                </FieldDescription>
              </FieldContent>
            </Field>
            {notify && (
              <Field>
                <Textarea
                  aria-label="Message Slack"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-28"
                  disabled={busy}
                />
                {ready.author && (
                  <FieldDescription>
                    @{ready.author.login}
                    {ready.author.name && ` (${ready.author.name})`} sera
                    mentionné : l'agent retrouve son compte Slack, sinon il
                    écrit son nom en clair.
                  </FieldDescription>
                )}
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            Annuler
          </DialogClose>
          <Button
            onClick={() => void confirm().catch(() => undefined)}
            disabled={busy}
          >
            {busy ? (
              <Spinner data-icon="inline-start" />
            ) : review.event === "APPROVE" ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <MessageSquareWarningIcon data-icon="inline-start" />
            )}
            {actions.review.isPending
              ? "Envoi de la review…"
              : send.isPending
                ? "Message Slack… (20 à 40 s)"
                : willNotify
                  ? `${copy.action} et prévenir`
                  : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
