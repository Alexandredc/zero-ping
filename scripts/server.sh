#!/bin/zsh
# Starts, stops or reports the production server on port 4747.
# Same behaviour as the `inbox` shell function, usable outside an interactive shell
# (the macOS app calls it). Usage: scripts/server.sh start [--no-build] | stop | status
set -u
# System tools must resolve even when the caller passes a minimal PATH.
export PATH="$PATH:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT="${0:A:h:h}"
PORT="${INBOX_PORT:-4747}"
LOG="$HOME/Library/Logs/inbox.log"

listening_pid() { lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 }

notify() {
  osascript -e "display notification \"$1\" with title \"Zéro Ping\"" >/dev/null 2>&1
}

case "${1:-status}" in
  start)
    [[ -n $(listening_pid) ]] && { echo "Zéro Ping tourne déjà"; exit 0; }
    bundle="$ROOT/dist/server/server.js"
    # Rebuilds only when the sources changed since the last build.
    if [[ ${2:-} != --no-build ]] && [[ ! -f $bundle || -n $(find "$ROOT/src" "$ROOT/drizzle" "$ROOT/package.json" -newer "$bundle" -print -quit) ]]; then
      notify "Build en cours…"
      (cd "$ROOT" && pnpm build >"$LOG" 2>&1) || { echo "Build échoué, voir $LOG"; exit 1; }
    fi
    (cd "$ROOT" && PORT=$PORT nohup pnpm start >>"$LOG" 2>&1 </dev/null &)
    for _ in {1..40}; do
      [[ -n $(listening_pid) ]] && { echo "Zéro Ping démarré"; exit 0; }
      sleep 0.5
    done
    echo "Zéro Ping ne répond pas, voir $LOG"
    exit 1
    ;;
  stop)
    pid=$(listening_pid)
    [[ -z $pid ]] && { echo "Zéro Ping n'est pas lancé"; exit 0; }
    if ! ps -o command= -p "$pid" | grep -q srvx; then
      echo "Le port $PORT est pris par un autre programme (PID $pid), rien n'a été arrêté"
      exit 1
    fi
    kill "$pid"
    for _ in {1..10}; do
      ps -p "$pid" >/dev/null || { echo "Zéro Ping arrêté"; exit 0; }
      sleep 0.5
    done
    kill -9 "$pid" && echo "Zéro Ping arrêté (forcé)"
    ;;
  status)
    [[ -n $(listening_pid) ]] && echo running || echo stopped
    ;;
  *)
    echo "Usage : scripts/server.sh start [--no-build] | stop | status"
    exit 1
    ;;
esac
