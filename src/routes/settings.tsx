import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { ArrowLeftIcon, LockIcon, PlusIcon } from "lucide-react"
import { Sidebar } from "@/components/inbox/sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  accessibleReposQuery,
  reposQuery,
  useInboxActions,
} from "@/hooks/use-inbox"

export const Route = createFileRoute("/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(reposQuery()),
  component: SettingsPage,
})

function AddRepo({ known }: { known: Set<string> }) {
  const [open, setOpen] = useState(false)
  const { data, isPending } = useQuery({
    ...accessibleReposQuery(),
    enabled: open,
  })
  const { trackRepo } = useInboxActions()
  const candidates = (data ?? []).filter((repo) => !known.has(repo.fullName))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        Ajouter un repo
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Chercher parmi tes repos…" />
          <CommandList>
            <CommandEmpty>
              {isPending ? "Chargement de tes repos…" : "Aucun repo trouvé."}
            </CommandEmpty>
            <CommandGroup>
              {candidates.map((repo) => (
                <CommandItem
                  key={repo.fullName}
                  value={repo.fullName}
                  onSelect={() => {
                    trackRepo.mutate({ fullName: repo.fullName, tracked: true })
                    setOpen(false)
                  }}
                >
                  <span className="truncate font-mono text-xs">
                    {repo.fullName}
                  </span>
                  {repo.private && <LockIcon className="ml-auto opacity-50" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function SettingsPage() {
  const { data: repos, isPending } = useQuery(reposQuery())
  const { trackRepo } = useInboxActions()
  const known = new Set((repos ?? []).map((repo) => repo.fullName))

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              nativeButton={false}
              render={
                <Link
                  to="/"
                  search={{ folder: "review" }}
                  aria-label="Retour à l'inbox"
                />
              }
            >
              <ArrowLeftIcon />
            </Button>
            <div>
              <h1 className="font-heading text-lg font-semibold tracking-tight">
                Repos suivis
              </h1>
              <p className="text-xs text-muted-foreground">
                Seuls les repos activés apparaissent dans l'inbox. Les nouveaux
                repos qui t'envoient des notifications sont ajoutés et activés
                automatiquement.
              </p>
            </div>
          </div>
          <AddRepo known={known} />
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <ul className="mx-auto flex max-w-3xl flex-col px-6 py-4">
            {isPending &&
              Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="my-2 h-8 w-full" />
              ))}
            {repos?.map((repo) => (
              <li
                key={repo.fullName}
                className="flex items-center gap-3 border-b py-3"
              >
                <label
                  htmlFor={`repo-${repo.fullName}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="truncate font-mono text-sm">
                    {repo.fullName}
                  </span>
                  {repo.active > 0 && (
                    <Badge variant="secondary">{repo.active} à traiter</Badge>
                  )}
                </label>
                <Switch
                  id={`repo-${repo.fullName}`}
                  checked={repo.tracked}
                  onCheckedChange={(tracked) =>
                    trackRepo.mutate({ fullName: repo.fullName, tracked })
                  }
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      </main>
    </div>
  )
}
