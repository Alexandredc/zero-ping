import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useI18n } from "@/hooks/use-i18n"

export function Markdown({ children }: { children: string }) {
  const { t } = useI18n()
  if (!children.trim()) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {t.detail.markdown.empty}
      </p>
    )
  }
  return (
    <div className="prose-comment">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
