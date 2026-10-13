import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { CircleCheckIcon, CircleDotIcon } from "lucide-react"
import { GitHubIcon } from "@/components/brand-icons"
import { GitHubConversation } from "@/components/inbox/github-conversation"
import { ItemInsights } from "@/components/inbox/item-insights"
import { ProjectFields } from "@/components/inbox/project-fields"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { workConversationQuery } from "@/hooks/use-inbox"
import { cn } from "@/lib/utils"
import { useI18n } from "@/hooks/use-i18n"
import type { LinkedIssue } from "@/server/inbox/actions"

function IssueView({ issue }: { issue: LinkedIssue }) {
  const { t } = useI18n()
  const { data, isPending, error } = useQuery(
    workConversationQuery(issue.key, "Issue")
  )
  const open = issue.state === "OPEN"
  const StateIcon = open ? CircleDotIcon : CircleCheckIcon
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <StateIcon
                className={cn(
                  "size-3.5",
                  open ? "text-diff-add-strong" : "text-primary"
                )}
              />
              {issue.key}
              <span className="font-sans">
                ·{" "}
                {open
                  ? t.detail.linkedIssues.open
                  : t.detail.linkedIssues.closed}
                {issue.assignees.length > 0 &&
                  ` · ${issue.assignees.map((login) => `@${login}`).join(", ")}`}
              </span>
            </p>
            <h3 className="font-heading text-base leading-tight font-semibold">
              {issue.title}
            </h3>
          </div>
          <Button
            variant="outline"
            size="xs"
            nativeButton={false}
            render={<a href={issue.url} target="_blank" rel="noreferrer" />}
          >
            <GitHubIcon data-icon="inline-start" />
            {t.common.open}
          </Button>
        </div>
        <ProjectFields itemKey={issue.key} />
      </header>
      <ItemInsights
        itemKey={issue.key}
        kind="issue"
        subject={{ kind: "Issue", title: issue.title, url: issue.url }}
      />
      <GitHubConversation
        conversation={data}
        isPending={isPending}
        error={error}
        // The reply box below answers the PR: an issue is answered on GitHub.
        onReplyInThread={() => window.open(issue.url, "_blank")}
      />
    </div>
  )
}

/** The issues the PR closes, one at a time, with their board fields and conversation. */
export function LinkedIssues({ issues }: { issues: LinkedIssue[] }) {
  const { t } = useI18n()
  const [chosen, setChosen] = useState(issues[0]?.key)
  const issue = issues.find((i) => i.key === chosen) ?? issues.at(0)
  if (!issue) return null
  return (
    <div className="flex flex-col gap-4">
      {issues.length > 1 && (
        <ToggleGroup
          value={[issue.key]}
          onValueChange={(value) => value[0] && setChosen(value[0])}
          variant="outline"
          size="sm"
          aria-label={t.detail.linkedIssues.choose}
          className="flex-wrap"
        >
          {issues.map((linked) => (
            <ToggleGroupItem key={linked.key} value={linked.key}>
              #{linked.number}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <IssueView key={issue.key} issue={issue} />
    </div>
  )
}
