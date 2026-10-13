#!/bin/zsh
# Regenerates docs/screenshots from the demo: starts its own demo server (fictional
# data, nothing sent to GitHub, Slack or an AI), captures every page in light and
# dark with agent-browser, then converts them to WebP.
# Needs agent-browser, and cwebp or Python with Pillow. Usage: pnpm screenshots [name…]
set -eu
export PATH="$PATH:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT="${0:A:h:h}"
PORT="${SCREENSHOTS_PORT:-3999}"
URL="http://localhost:$PORT"
OUT="$ROOT/docs/screenshots"
SESSION="zero-ping-screenshots"
TMP=$(mktemp -d)
LOG="$TMP/demo.log"

command -v agent-browser >/dev/null || { echo "agent-browser est introuvable"; exit 1; }
if lsof -ti :"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  # Never capture a server this script did not start: it could hold real data.
  echo "Le port $PORT est déjà pris : choisis-en un autre avec SCREENSHOTS_PORT."
  exit 1
fi

ab() { agent-browser --session "$SESSION" "$@" >/dev/null }

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  # The port was free before: whatever listens on it now is this demo.
  for signal in TERM TERM TERM TERM KILL; do
    pids=$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null) || break
    kill -$signal ${(f)pids} 2>/dev/null || true
    sleep 1
  done
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

# Its own data folder: a demo already running keeps its database locked.
(cd "$ROOT" && DEMO=1 DATA_DIR="$TMP/data" pnpm exec vite dev --port "$PORT" --strictPort >"$LOG" 2>&1 &)
for _ in {1..60}; do
  curl -sf "$URL/api/pings" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "$URL/api/pings" >/dev/null || { cat "$LOG"; echo "Le serveur démo ne répond pas"; exit 1; }

# Hides the dev-only devtools button, then lets the page settle.
settle() {
  ab eval "document.head.insertAdjacentHTML('beforeend', '<style>[data-testid=tanstack_devtools]{display:none!important}</style>')"
  ab wait "${1:-2500}"
}

page() { ab open "$URL$1" && settle "${2:-}" }

# One function per screenshot: it leaves the page as it should be captured.
shot_inbox() { page "/?folder=review&item=acme%2Fapi%23412" 3500 }
shot_diff() {
  shot_inbox
  ab press d && ab wait 1500
}
shot_slack() {
  shot_inbox
  ab eval "document.querySelector('[aria-label=\"Discussions Slack\"]').scrollIntoView({ block: 'start' })"
  ab wait 800
}
shot_review() {
  shot_inbox
  ab fill 'textarea[placeholder^="Écris ta réponse"]' "Le compteur doit être partagé entre instances avant la mise en prod."
  ab find role button click --name "Demander des changements"
  ab wait 2000
}
shot_team() { page "/team" }
shot_sprint() { page "/issues?tab=team&item=acme%2Fweb%23236" 3500 }
shot_dashboard() { page "/dashboard" }
shot_recap() { page "/recap?tab=team" }
shot_settings() { page "/settings?section=agent" }

NAMES=(inbox diff slack review team sprint dashboard recap settings)
(( $# > 0 )) && NAMES=("$@")

to_webp() {
  if command -v cwebp >/dev/null; then
    cwebp -quiet -q 82 -m 6 "$1" -o "$2"
  else
    python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=82, method=6)' "$1" "$2"
  fi
}

mkdir -p "$OUT"
ab set viewport 1440 900 2
for theme in light dark; do
  ab set media "$theme"
  for name in $NAMES; do
    "shot_$name"
    ab screenshot "$TMP/$name-$theme.png"
    to_webp "$TMP/$name-$theme.png" "$OUT/$name-$theme.webp"
    echo "docs/screenshots/$name-$theme.webp"
  done
done
