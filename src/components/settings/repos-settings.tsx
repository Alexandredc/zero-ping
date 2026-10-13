import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { LockIcon, PlusIcon, SearchIcon } from "lucide-react"
import { GitHubIcon } from "@/components/brand-icons"
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/hooks/use-i18n"
import {
  accessibleReposQuery,
  reposQuery,
  useInboxActions,
} from "@/hooks/use-inbox"

function AddRepo({ known }: { known: Set<string> }) {
  const { t } = useI18n()
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
        {t.settings.repos.add}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder={t.settings.repos.search} />
          <CommandList>
            <CommandEmpty>
              {isPending
                ? t.settings.repos.loading
                : t.settings.repos.noneFound}
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

export function ReposSettings() {
  const { t } = useI18n()
  const { data: repos, isPending } = useQuery(reposQuery())
  const { trackRepo } = useInboxActions()
  const [filter, setFilter] = useState("")
  const known = new Set((repos ?? []).map((repo) => repo.fullName))
  const visible = (repos ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(filter.trim().toLowerCase())
  )
  const tracked = (repos ?? []).filter((repo) => repo.tracked).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitHubIcon />
          {t.settings.repos.title}
        </CardTitle>
        <CardDescription>{t.settings.repos.description}</CardDescription>
        <CardAction>
          <AddRepo known={known} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <InputGroup className="max-w-xs">
            <InputGroupInput
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t.settings.repos.filter}
              aria-label={t.settings.repos.filter}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
          {repos && (
            <span className="text-xs text-muted-foreground">
              {t.settings.repos.trackedCount(tracked, repos.length)}
            </span>
          )}
        </div>
        <ul className="flex flex-col">
          {isPending &&
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="my-2 h-8 w-full" />
            ))}
          {visible.map((repo) => (
            <li
              key={repo.fullName}
              className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <label
                htmlFor={`repo-${repo.fullName}`}
                className="flex min-w-0 flex-1 items-center gap-2"
              >
                <span className="truncate font-mono text-sm">
                  {repo.fullName}
                </span>
                {repo.active > 0 && (
                  <Badge variant="secondary">
                    {t.settings.repos.toHandle(repo.active)}
                  </Badge>
                )}
              </label>
              <Switch
                id={`repo-${repo.fullName}`}
                checked={repo.tracked}
                onCheckedChange={(checked) =>
                  trackRepo.mutate({
                    fullName: repo.fullName,
                    tracked: checked,
                  })
                }
              />
            </li>
          ))}
          {repos && visible.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">
              {t.settings.repos.noMatch(filter)}
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
