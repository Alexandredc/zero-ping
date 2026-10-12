import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BellIcon,
  SparklesIcon,
  SunriseIcon,
} from "lucide-react"
import { z } from "zod"
import { GitHubIcon, SlackIcon } from "@/components/brand-icons"
import { Sidebar } from "@/components/inbox/sidebar"
import { AgentSettings } from "@/components/settings/agent-settings"
import { NotificationSettings } from "@/components/settings/notification-settings"
import { ReposSettings } from "@/components/settings/repos-settings"
import { SlackSettings } from "@/components/settings/slack-settings"
import {
  RecapSettings,
  TriageSettings,
} from "@/components/settings/triage-settings"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { reposQuery, settingsQuery } from "@/hooks/use-inbox"

const SECTIONS = [
  "repos",
  "triage",
  "recap",
  "slack",
  "agent",
  "notifications",
] as const
type Section = (typeof SECTIONS)[number]

export const Route = createFileRoute("/settings")({
  validateSearch: z.object({ section: z.enum(SECTIONS).default("repos") }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(reposQuery()),
      context.queryClient.ensureQueryData(settingsQuery()),
    ]),
  component: SettingsPage,
})

function SettingsPage() {
  const { section } = Route.useSearch()
  const navigate = useNavigate({ from: "/settings" })
  const { data: settings } = useQuery(settingsQuery())

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-6 py-4">
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
              Réglages
            </h1>
            <p className="text-xs text-muted-foreground">
              Enregistrés sur ton Mac, appliqués tout de suite.
            </p>
          </div>
        </header>
        <Tabs
          value={section}
          onValueChange={(value) =>
            navigate({ search: { section: value as Section }, replace: true })
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b px-6">
            <TabsList variant="line" className="h-10">
              <TabsTrigger value="repos">
                <GitHubIcon />
                Repos
              </TabsTrigger>
              <TabsTrigger value="triage">
                <ArchiveIcon />
                Classement
              </TabsTrigger>
              <TabsTrigger value="recap">
                <SunriseIcon />
                Récap
              </TabsTrigger>
              <TabsTrigger value="slack">
                <SlackIcon />
                Slack
              </TabsTrigger>
              <TabsTrigger value="agent">
                <SparklesIcon />
                Agent IA
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <BellIcon />
                Notifications
              </TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto w-full max-w-3xl px-6 py-6">
              <TabsContent value="repos">
                <ReposSettings />
              </TabsContent>
              <TabsContent value="triage">
                {settings ? (
                  <TriageSettings settings={settings} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </TabsContent>
              <TabsContent value="recap">
                {settings ? (
                  <RecapSettings settings={settings} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </TabsContent>
              <TabsContent value="slack">
                {settings ? (
                  <SlackSettings settings={settings} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </TabsContent>
              <TabsContent value="agent">
                {settings ? (
                  <AgentSettings settings={settings} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </TabsContent>
              <TabsContent value="notifications">
                {settings ? (
                  <NotificationSettings settings={settings} />
                ) : (
                  <Skeleton className="h-64" />
                )}
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </main>
    </div>
  )
}
