import { useRef } from "react"
import { BellIcon } from "lucide-react"
import type { getSettings } from "@/server/inbox/actions"
import type { AttentionKind } from "@/server/db/schema"
import { showNotification } from "@/components/notifications/attention-watcher"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/hooks/use-i18n"
import { useSavePreferences } from "@/hooks/use-inbox"
import { useNotificationPermission } from "@/hooks/use-notification-permission"
import { toast } from "@/components/ui/toast"

type Settings = Awaited<ReturnType<typeof getSettings>>

const KINDS = [
  "review",
  "awaiting",
  "changes",
  "ci",
] as const satisfies AttentionKind[]

export function NotificationSettings({ settings }: { settings: Settings }) {
  const { t, language } = useI18n()
  const m = t.settings.notifications
  const save = useSavePreferences()
  const { permission, request } = useNotificationPermission()
  const lastTest = useRef<Notification | null>(null)
  const { notifyEnabled, notifyKinds } = settings.preferences

  const sendTest = () => {
    // The previous test may still sit on screen: macOS then folds the new one into it.
    lastTest.current?.close()
    const sentAt = new Date().toLocaleTimeString(language)
    const notification = showNotification(m.kinds.review.label, {
      // The time keeps two tests from looking identical, which some browsers drop.
      body: m.testBody(sentAt),
      tag: `test-${Date.now()}`,
      renotify: true,
    } as NotificationOptions)
    lastTest.current = notification
    if (!notification) {
      toast.add({
        title: m.unavailable,
        description: m.unavailableDescription,
        type: "error",
      })
      return
    }
    notification.onshow = () =>
      toast.add({
        title: m.delivered,
        // The browser can accept a notification that macOS then hides.
        description: m.macosHint,
      })
    notification.onerror = () =>
      toast.add({
        title: m.refused,
        description: m.macosHint,
        type: "error",
      })
  }

  const toggleKind = (kind: AttentionKind, on: boolean) =>
    save.mutate({
      notifyKinds: on
        ? [...notifyKinds, kind]
        : notifyKinds.filter((k) => k !== kind),
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="size-4" />
          {m.title}
        </CardTitle>
        <CardDescription>{m.description}</CardDescription>
        <CardAction>
          <Badge variant={permission === "granted" ? "secondary" : "outline"}>
            {m.permission[permission]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {permission === "default" && (
          <Alert>
            <BellIcon />
            <AlertTitle>{m.allowTitle}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              {m.allowDescription}
              <Button size="sm" onClick={() => void request()}>
                {m.allow}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {permission === "denied" && (
          <Alert variant="destructive">
            <AlertTitle>{m.blockedTitle}</AlertTitle>
            <AlertDescription>{m.blockedDescription}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="notify-enabled">{m.enable}</FieldLabel>
              <FieldDescription>{m.enableDescription}</FieldDescription>
            </FieldContent>
            <Switch
              id="notify-enabled"
              checked={notifyEnabled}
              onCheckedChange={(checked) =>
                save.mutate({ notifyEnabled: checked })
              }
            />
          </Field>
          <FieldSeparator />
          <FieldSet disabled={!notifyEnabled}>
            <FieldLegend variant="label">{m.notifyFor}</FieldLegend>
            {KINDS.map((kind) => (
              <Field
                key={kind}
                orientation="horizontal"
                data-disabled={!notifyEnabled || undefined}
              >
                <FieldContent>
                  <FieldLabel htmlFor={`notify-${kind}`}>
                    {m.kinds[kind].label}
                  </FieldLabel>
                  <FieldDescription>
                    {m.kinds[kind].description}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id={`notify-${kind}`}
                  checked={notifyKinds.includes(kind)}
                  disabled={!notifyEnabled}
                  onCheckedChange={(checked) => toggleKind(kind, checked)}
                />
              </Field>
            ))}
          </FieldSet>
          <FieldSeparator />
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>{m.test}</FieldLabel>
              <FieldDescription>{m.testDescription}</FieldDescription>
            </FieldContent>
            <Button
              variant="outline"
              size="sm"
              disabled={permission !== "granted"}
              onClick={sendTest}
            >
              {m.sendTest}
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
