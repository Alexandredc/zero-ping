import { Kbd } from "@/components/ui/kbd"
import { useI18n } from "@/hooks/use-i18n"

/** A list whose top row slides into an open panel: what picking an item does. */
function PickIllustration() {
  return (
    <svg
      viewBox="0 0 220 140"
      fill="none"
      aria-hidden
      className="h-auto w-56 text-muted-foreground"
    >
      {/* The list */}
      <rect
        x="6"
        y="18"
        width="76"
        height="22"
        rx="5"
        className="fill-primary/10 stroke-primary"
        strokeWidth="1.5"
      />
      <circle cx="17" cy="29" r="4" className="fill-primary" />
      <rect
        x="26"
        y="25"
        width="46"
        height="3"
        rx="1.5"
        className="fill-primary/70"
      />
      <rect
        x="26"
        y="31"
        width="30"
        height="3"
        rx="1.5"
        className="fill-primary/40"
      />
      {[50, 80, 110].map((y, index) => (
        <g key={y} opacity={1 - index * 0.25}>
          <rect
            x="6"
            y={y}
            width="76"
            height="22"
            rx="5"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          <circle
            cx="17"
            cy={y + 11}
            r="4"
            fill="currentColor"
            fillOpacity="0.3"
          />
          <rect
            x="26"
            y={y + 7}
            width="46"
            height="3"
            rx="1.5"
            fill="currentColor"
            fillOpacity="0.3"
          />
          <rect
            x="26"
            y={y + 13}
            width="26"
            height="3"
            rx="1.5"
            fill="currentColor"
            fillOpacity="0.2"
          />
        </g>
      ))}
      {/* The way from the row to the panel */}
      <path
        d="M86 29 C 104 29, 106 52, 124 52"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
      />
      <path
        d="M119 47 L 125 52 L 119 57"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The open panel */}
      <rect
        x="130"
        y="10"
        width="84"
        height="120"
        rx="7"
        className="fill-card"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <rect
        x="140"
        y="22"
        width="40"
        height="3"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.35"
      />
      <rect
        x="140"
        y="30"
        width="62"
        height="5"
        rx="2.5"
        className="fill-primary/60"
      />
      <rect
        x="140"
        y="44"
        width="64"
        height="26"
        rx="4"
        className="fill-primary/10"
      />
      <rect
        x="146"
        y="51"
        width="20"
        height="3"
        rx="1.5"
        className="fill-primary/50"
      />
      <rect
        x="146"
        y="58"
        width="30"
        height="5"
        rx="2"
        className="fill-primary/70"
      />
      <rect
        x="180"
        y="51"
        width="18"
        height="12"
        rx="2"
        className="fill-primary/25"
      />
      {[80, 88, 96, 108, 116].map((y, index) => (
        <rect
          key={y}
          x="140"
          y={y}
          width={index % 3 === 2 ? 38 : 62}
          height="3"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.22"
        />
      ))}
    </svg>
  )
}

/** What the detail side shows while nothing is open. */
export function DetailPlaceholder({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className="hidden flex-1 items-center justify-center p-8 lg:flex">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <PickIllustration />
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-balance text-muted-foreground">
            {children}
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> {t.inbox.placeholder.browse} · <Kbd>f</Kbd>{" "}
          {t.inbox.placeholder.fullscreen} · <Kbd>o</Kbd>{" "}
          {t.inbox.placeholder.openOnGitHub}
        </p>
      </div>
    </div>
  )
}
