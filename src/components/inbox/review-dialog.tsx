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
import { useI18n } from "@/hooks/use-i18n"

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES"

export type PendingReview = {
  key: string
  event: ReviewEvent
  /** The comment typed in the panel, sent with the review. */
  body: string
  /** Empties the panel's comment box once the review is sent. */
  onSent: () => void
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
  const { t } = useI18n()
  const actions = useInboxActions()
  const send = useSendReviewNotice()
  const { data: notice } = useQuery(reviewNoticeQuery(review.key, review.event))
  // An approval rarely needs a ping: the message is offered, not sent by default.
  const [notify, setNotify] = useState(review.event !== "APPROVE")
  const [message, setMessage] = useState("")
  // A reply buried in an old thread goes unseen: it also shows in the channel.
  const [broadcast, setBroadcast] = useState(true)
  const ready = notice?.enabled ? notice : null
  const copy =
    review.event === "APPROVE"
      ? t.detail.review.approve
      : t.detail.review.requestChanges

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
        broadcast,
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
                  {t.detail.review.notifyAuthor}
                </FieldLabel>
                <FieldDescription>
                  {ready.threadPermalink
                    ? t.detail.review.inThread(ready.channel)
                    : t.detail.review.newMessage(ready.channel)}
                </FieldDescription>
              </FieldContent>
            </Field>
            {notify && ready.threadPermalink && (
              <Field orientation="horizontal">
                <Checkbox
                  id="review-broadcast"
                  checked={broadcast}
                  onCheckedChange={setBroadcast}
                  disabled={busy}
                />
                <FieldContent>
                  <FieldLabel htmlFor="review-broadcast">
                    {t.detail.review.broadcast(ready.channel)}
                  </FieldLabel>
                  <FieldDescription>
                    {t.detail.review.broadcastHint}
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
            {notify && (
              <Field>
                <Textarea
                  aria-label={t.detail.review.slackMessage}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-28"
                  disabled={busy}
                />
                {ready.author && (
                  <FieldDescription>
                    {t.detail.review.willBeMentioned(
                      `@${ready.author.login}${ready.author.name ? ` (${ready.author.name})` : ""}`
                    )}
                  </FieldDescription>
                )}
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={busy} />}>
            {t.common.cancel}
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
              ? t.detail.review.sendingReview
              : send.isPending
                ? t.detail.review.sendingSlack
                : willNotify
                  ? t.detail.review.actionAndNotify(copy.action)
                  : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
