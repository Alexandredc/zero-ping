import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BellIcon,
  LanguagesIcon,
  SparklesIcon,
  SunriseIcon,
} from "lucide-react"
import { z } from "zod"
import { GitHubIcon, SlackIcon } from "@/components/brand-icons"
import { Sidebar } from "@/components/inbox/sidebar"
import { PAGE_ICONS } from "@/components/inbox/pages"
import { AgentSettings } from "@/components/settings/agent-settings"
import { LanguageSettings } from "@/components/settings/language-settings"
import { NotificationSettings } from "@/components/settings/notification-settings"
import {
  QuietSettings,
  SyncSettings,
} from "@/components/settings/quiet-settings"
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
import { useI18n } from "@/hooks/use-i18n"
import { reposQuery, settingsQuery } from "@/hooks/use-inbox"

const SECTIONS = [
  "repos",
  "triage",
  "recap",
  "slack",
  "agent",
  "notifications",
  "language",
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
  const { t } = useI18n()

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
                aria-label={t.nav.status.backToInbox}
              />
            }
          >
            <ArrowLeftIcon />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
              <PAGE_ICONS.settings className="size-5 shrink-0 text-muted-foreground" />
              {t.nav.pages.settings}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t.settings.subtitle}
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
                {t.settings.tabs.repos}
              </TabsTrigger>
              <TabsTrigger value="triage">
                <ArchiveIcon />
                {t.settings.tabs.triage}
              </TabsTrigger>
              <TabsTrigger value="recap">
                <SunriseIcon />
                {t.settings.tabs.recap}
              </TabsTrigger>
              <TabsTrigger value="slack">
                <SlackIcon />
                {t.settings.tabs.slack}
              </TabsTrigger>
              <TabsTrigger value="agent">
                <SparklesIcon />
                {t.settings.tabs.agent}
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <BellIcon />
                {t.settings.tabs.notifications}
              </TabsTrigger>
              <TabsTrigger value="language">
                <LanguagesIcon />
                {t.settings.tabs.language}
              </TabsTrigger>
            </TabsList>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6">
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
                  <div className="flex flex-col gap-4">
                    <NotificationSettings settings={settings} />
                    <QuietSettings />
                    <SyncSettings />
                  </div>
                ) : (
                  <Skeleton className="h-64" />
                )}
              </TabsContent>
              <TabsContent value="language">
                <LanguageSettings />
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </main>
    </div>
  )
}
