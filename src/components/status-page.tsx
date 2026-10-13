import { Link, useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { InboxIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { APP_NAME, LOGO_URL } from "@/lib/pings"

/** A full-page message with the app's logo, for errors and unknown addresses. */
function StatusPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <img src={LOGO_URL} alt={APP_NAME} className="size-16" />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </main>
  )
}

function BackToInbox() {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link to="/" search={{ folder: "review" }} />}
    >
      <InboxIcon data-icon="inline-start" />
      Retour à l'inbox
    </Button>
  )
}

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const message = error instanceof Error ? error.message : String(error)
  return (
    <StatusPage
      title="Quelque chose a coincé"
      description={`${APP_NAME} n'a pas pu afficher cette page. Souvent, GitHub ou la connexion a répondu de travers : réessaie dans un instant.`}
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          <RotateCwIcon data-icon="inline-start" />
          Réessayer
        </Button>
        <BackToInbox />
      </div>
      {message && (
        <details className="w-full rounded-lg border bg-muted/40 p-3 text-left text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            Détail de l'erreur
          </summary>
          <pre className="mt-2 font-mono break-words whitespace-pre-wrap">
            {message}
          </pre>
        </details>
      )}
    </StatusPage>
  )
}

export function NotFoundPage() {
  return (
    <StatusPage
      title="Page introuvable"
      description="Cette adresse ne correspond à aucune vue de l'app."
    >
      <BackToInbox />
    </StatusPage>
  )
}
