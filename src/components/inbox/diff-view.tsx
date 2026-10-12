import { useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"
import {
  CheckIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react"
import { Hint } from "./hint"
import type { PullFile } from "@/server/github/pull-files"
import { filesQuery, useFileViewed } from "@/hooks/use-inbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { parsePatch } from "@/lib/diff"
import { buildFileTree } from "@/lib/file-tree"
import type { TreeNode } from "@/lib/file-tree"
import { cn } from "@/lib/utils"

const STATUS_LABEL: Record<string, string> = {
  added: "ajouté",
  removed: "supprimé",
  renamed: "renommé",
  copied: "copié",
}

/** Generated or noisy files start collapsed, like on GitHub. */
const NOISY =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|go\.sum)$|\.snap$|\.min\.(js|css)$|(^|\/)(dist|build|generated)\//
const LARGE_FILE_LINES = 400

function openByDefault(file: PullFile): boolean {
  return (
    file.viewed !== "VIEWED" &&
    !NOISY.test(file.filename) &&
    file.additions + file.deletions <= LARGE_FILE_LINES
  )
}

function Counts({
  additions,
  deletions,
}: {
  additions: number
  deletions: number
}) {
  return (
    <span className="font-mono text-xs tabular-nums">
      <span className="text-diff-add-strong">+{additions}</span>{" "}
      <span className="text-diff-del-strong">−{deletions}</span>
    </span>
  )
}

function statusColor(status: string) {
  if (status === "added") return "text-diff-add-strong"
  if (status === "removed") return "text-diff-del-strong"
  return "text-muted-foreground"
}

function TreeItems({
  nodes,
  depth,
  onSelect,
}: {
  nodes: TreeNode<PullFile>[]
  depth: number
  onSelect: (file: PullFile) => void
}) {
  return (
    <ul className="flex flex-col">
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <TreeFolderItem
            key={node.path}
            node={node}
            depth={depth}
            onSelect={onSelect}
          />
        ) : (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => onSelect(node.file)}
              style={{ paddingLeft: `${depth * 12 + 22}px` }}
              className="flex w-full items-center gap-1.5 rounded py-1 pr-1 text-left text-xs hover:bg-muted"
            >
              <FileIcon
                className={cn(
                  "size-3.5 shrink-0",
                  statusColor(node.file.status)
                )}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-mono",
                  node.file.viewed === "VIEWED" &&
                    "text-muted-foreground line-through"
                )}
              >
                {node.name}
              </span>
              {node.file.viewed === "VIEWED" ? (
                <CheckIcon className="size-3.5 shrink-0 text-diff-add-strong" />
              ) : (
                <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground tabular-nums">
                  {node.file.additions + node.file.deletions}
                </span>
              )}
            </button>
          </li>
        )
      )}
    </ul>
  )
}

function TreeFolderItem({
  node,
  depth,
  onSelect,
}: {
  node: Extract<TreeNode<PullFile>, { kind: "folder" }>
  depth: number
  onSelect: (file: PullFile) => void
}) {
  const [open, setOpen] = useState(true)
  const Icon = open ? FolderOpenIcon : FolderIcon
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        className="flex w-full items-center gap-1 rounded py-1 pr-1 text-left text-xs hover:bg-muted"
      >
        <ChevronRightIcon
          className={cn(
            "size-3 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono">{node.name}</span>
      </button>
      {open && (
        <TreeItems
          nodes={node.children}
          depth={depth + 1}
          onSelect={onSelect}
        />
      )}
    </li>
  )
}

function FileDiff({
  file,
  open,
  onToggle,
  onViewed,
  sectionRef,
}: {
  file: PullFile
  open: boolean
  onToggle: () => void
  onViewed: (viewed: boolean) => void
  sectionRef: (element: HTMLElement | null) => void
}) {
  const lines = open && file.patch ? parsePatch(file.patch) : []
  const viewed = file.viewed === "VIEWED"

  return (
    <section
      ref={sectionRef}
      className="scroll-mt-2 overflow-hidden rounded-lg border bg-card"
    >
      <header className="flex items-center gap-2 bg-muted/50 px-3 py-2 text-xs">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:underline"
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
          <span
            className={cn(
              "truncate font-mono",
              viewed && "text-muted-foreground"
            )}
          >
            {file.previousFilename && (
              <span className="text-muted-foreground">
                {file.previousFilename} →{" "}
              </span>
            )}
            {file.filename}
          </span>
        </button>
        {file.viewed === "DISMISSED" && (
          <Hint content="Tu l'avais marqué comme vu, mais il a changé depuis.">
            <Badge
              variant="outline"
              className="cursor-help border-heat/40 text-heat-foreground"
            >
              modifié depuis
            </Badge>
          </Hint>
        )}
        {STATUS_LABEL[file.status] && (
          <Badge variant="outline">{STATUS_LABEL[file.status]}</Badge>
        )}
        <Counts additions={file.additions} deletions={file.deletions} />
        <Hint content="Marqué aussi comme vu sur GitHub">
          <label className="flex cursor-pointer items-center gap-1.5 rounded border bg-background px-1.5 py-0.5">
            <Checkbox
              checked={viewed}
              onCheckedChange={(checked) => onViewed(checked)}
            />
            Vu
          </label>
        </Hint>
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Voir ${file.filename} sur GitHub`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLinkIcon className="size-3.5" />
        </a>
      </header>
      {open &&
        (file.patch ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs leading-5">
              <tbody>
                {lines.map((line, index) =>
                  line.kind === "hunk" ? (
                    <tr
                      key={index}
                      className="bg-accent/50 text-muted-foreground"
                    >
                      <td colSpan={3} className="px-3 py-0.5 whitespace-pre">
                        {line.text}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={index}
                      className={cn(
                        line.kind === "add" && "bg-diff-add",
                        line.kind === "del" && "bg-diff-del"
                      )}
                    >
                      <td className="w-10 px-2 text-right text-muted-foreground/70 select-none">
                        {line.oldLine}
                      </td>
                      <td className="w-10 px-2 text-right text-muted-foreground/70 select-none">
                        {line.newLine}
                      </td>
                      <td className="pr-4 whitespace-pre">
                        <span
                          className={cn(
                            "inline-block w-4 select-none",
                            line.kind === "add" && "text-diff-add-strong",
                            line.kind === "del" && "text-diff-del-strong"
                          )}
                        >
                          {line.kind === "add"
                            ? "+"
                            : line.kind === "del"
                              ? "−"
                              : " "}
                        </span>
                        {line.text}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            Diff non affiché (fichier binaire ou trop volumineux).{" "}
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Le voir sur GitHub
            </a>
          </p>
        ))}
    </section>
  )
}

export function DiffView({
  itemKey,
  htmlUrl,
}: {
  itemKey: string
  htmlUrl: string
}) {
  const { data, isPending, error } = useQuery(filesQuery(itemKey))
  const viewedMutation = useFileViewed(itemKey)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const sections = useRef(new Map<string, HTMLElement>())

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Diff indisponible</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  const isOpen = (file: PullFile) =>
    overrides[file.filename] ?? openByDefault(file)
  const setOpen = (file: PullFile, open: boolean) =>
    setOverrides((current) => ({ ...current, [file.filename]: open }))
  const viewedCount = data.files.filter(
    (file) => file.viewed === "VIEWED"
  ).length
  const tree = buildFileTree(data.files, (file) => file.filename)

  const select = (file: PullFile) => {
    setOpen(file, true)
    requestAnimationFrame(() =>
      sections.current
        .get(file.filename)
        ?.scrollIntoView({ block: "start", behavior: "smooth" })
    )
  }

  const markViewed = (file: PullFile, viewed: boolean) => {
    // A file marked as viewed folds away, as on GitHub.
    setOpen(file, !viewed)
    viewedMutation.mutate({
      pullRequestId: data.pullRequestId,
      path: file.filename,
      viewed,
    })
  }

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {data.files.length} fichier{data.files.length > 1 ? "s" : ""}
        </span>
        <Counts
          additions={data.totalAdditions}
          deletions={data.totalDeletions}
        />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-diff-add-strong transition-[width]"
              style={{
                width: `${(viewedCount / Math.max(1, data.files.length)) * 100}%`,
              }}
            />
          </span>
          {viewedCount}/{data.files.length} vus
        </span>
        <a
          href={`${htmlUrl}/files`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 hover:text-foreground hover:underline"
        >
          Ouvrir le diff sur GitHub
          <ExternalLinkIcon className="size-3" />
        </a>
      </div>
      {data.truncated && (
        <p className="text-xs text-muted-foreground">
          Seuls les 300 premiers fichiers sont affichés.
        </p>
      )}
      <div className="grid gap-3 @3xl:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Arborescence des fichiers"
          className="max-h-72 overflow-y-auto rounded-lg border bg-card p-1.5 @3xl:sticky @3xl:top-0 @3xl:max-h-[calc(100svh-14rem)] @3xl:self-start"
        >
          <TreeItems nodes={tree} depth={0} onSelect={select} />
        </nav>
        <div className="flex min-w-0 flex-col gap-3">
          {data.files.map((file) => (
            <FileDiff
              key={file.filename}
              file={file}
              open={isOpen(file)}
              onToggle={() => setOpen(file, !isOpen(file))}
              onViewed={(viewed) => markViewed(file, viewed)}
              sectionRef={(element) => {
                if (element) sections.current.set(file.filename, element)
                else sections.current.delete(file.filename)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
