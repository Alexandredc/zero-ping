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
import { useSavePreferences } from "@/hooks/use-inbox"
import { useNotificationPermission } from "@/hooks/use-notification-permission"
import { toast } from "@/components/ui/toast"

type Settings = Awaited<ReturnType<typeof getSettings>>

const KINDS: { kind: AttentionKind; label: string; description: string }[] = [
  {
    kind: "review",
    label: "Review demandée",
    description: "On te demande une review, à toi ou à ton équipe.",
  },
  {
    kind: "awaiting",
    label: "On attend ta réponse",
    description:
      "Une mention ou une réponse dans un fil où tu n'as pas encore réagi.",
  },
  {
    kind: "changes",
    label: "Changements demandés sur ta PR",
    description: "Un reviewer demande des changements sur une de tes PR.",
  },
  {
    kind: "ci",
    label: "CI en échec sur ta PR",
    description: "La CI d'une de tes PR échoue.",
  },
]

/** The browser can accept a notification that macOS then hides. */
const MACOS_HINT =
  "Tu ne la vois pas ? Autorise ton navigateur dans Réglages Système > Notifications (Dia, Chrome…) et vérifie qu'aucun mode Concentration n'est actif."

const PERMISSION_LABEL = {
  granted: "autorisées",
  denied: "bloquées",
  default: "pas encore autorisées",
  unsupported: "non prises en charge",
}

export function NotificationSettings({ settings }: { settings: Settings }) {
  const save = useSavePreferences()
  const { permission, request } = useNotificationPermission()
  const lastTest = useRef<Notification | null>(null)
  const { notifyEnabled, notifyKinds } = settings.preferences

  const sendTest = () => {
    // The previous test may still sit on screen: macOS then folds the new one into it.
    lastTest.current?.close()
    const sentAt = new Date().toLocaleTimeString("fr")
    const notification = showNotification("Review demandée", {
      // The time keeps two tests from looking identical, which some browsers drop.
      body: `acme-web#1234 · Notification de test envoyée à ${sentAt}`,
      tag: `test-${Date.now()}`,
      renotify: true,
    } as NotificationOptions)
    lastTest.current = notification
    if (!notification) {
      toast.add({
        title: "Notification impossible",
        description: "Le navigateur ne l'autorise pas pour cette page.",
        type: "error",
      })
      return
    }
    notification.onshow = () =>
      toast.add({
        title: "Notification transmise à macOS",
        description: MACOS_HINT,
      })
    notification.onerror = () =>
      toast.add({
        title: "Notification refusée",
        description: MACOS_HINT,
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
          Notifications du navigateur
        </CardTitle>
        <CardDescription>
          Une notification apparaît quand une PR ou une issue demande ton
          attention, tant qu'un onglet Zéro Ping est ouvert. Clique dessus pour
          ouvrir l'élément.
        </CardDescription>
        <CardAction>
          <Badge variant={permission === "granted" ? "secondary" : "outline"}>
            {PERMISSION_LABEL[permission]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {permission === "default" && (
          <Alert>
            <BellIcon />
            <AlertTitle>Autorise les notifications</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              Le navigateur te demandera une seule fois ton accord.
              <Button size="sm" onClick={() => void request()}>
                Autoriser les notifications
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {permission === "denied" && (
          <Alert variant="destructive">
            <AlertTitle>Notifications bloquées par le navigateur</AlertTitle>
            <AlertDescription>
              Clique sur l'icône à gauche de l'adresse, autorise les
              notifications pour inbox.localhost, puis recharge la page.
            </AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="notify-enabled">
                Activer les notifications
              </FieldLabel>
              <FieldDescription>
                Rien n'est notifié pendant la première synchronisation, ni pour
                un élément traité ou en pause.
              </FieldDescription>
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
            <FieldLegend variant="label">Me prévenir pour</FieldLegend>
            {KINDS.map(({ kind, label, description }) => (
              <Field
                key={kind}
                orientation="horizontal"
                data-disabled={!notifyEnabled || undefined}
              >
                <FieldContent>
                  <FieldLabel htmlFor={`notify-${kind}`}>{label}</FieldLabel>
                  <FieldDescription>{description}</FieldDescription>
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
              <FieldLabel>Tester</FieldLabel>
              <FieldDescription>
                Affiche une notification d'exemple pour vérifier que ton
                navigateur et macOS les laissent passer.
              </FieldDescription>
            </FieldContent>
            <Button
              variant="outline"
              size="sm"
              disabled={permission !== "granted"}
              onClick={sendTest}
            >
              Envoyer un test
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
