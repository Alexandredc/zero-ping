#!/bin/zsh
# Brings an open Zéro Ping tab to the front instead of opening a new one.
# Tries the running browsers that can list their tabs; exits 1 when no tab
# was found, so the caller opens the inbox itself.
# Usage: scripts/focus-inbox.sh [url prefix, default http://inbox.localhost:4747]
set -uo pipefail

PREFIX="${1:-http://inbox.localhost:4747}"

# Checked through the process list: asking AppleScript about a browser that is
# not installed would pop a "Where is…?" dialog.
running() {
  pgrep -xq "$1"
}

# Each script is compiled at run time, so a browser that is not installed
# never breaks the others.
focus_dia() {
  osascript - "$PREFIX" <<'APPLESCRIPT'
on run argv
	set prefix to item 1 of argv
	tell application "Dia"
		repeat with w in windows
			repeat with t in tabs of w
				if URL of t starts with prefix then
					focus t
					activate
					return "ok"
				end if
			end repeat
		end repeat
	end tell
	return "none"
end run
APPLESCRIPT
}

# The browser name is written into the script: its terms (active tab index)
# only compile against a literal application.
focus_chromium() {
  osascript - "$PREFIX" <<APPLESCRIPT
on run argv
	set prefix to item 1 of argv
	tell application "$1"
		repeat with w in windows
			set i to 0
			repeat with t in tabs of w
				set i to i + 1
				if URL of t starts with prefix then
					set active tab index of w to i
					set index of w to 1
					activate
					return "ok"
				end if
			end repeat
		end repeat
	end tell
	return "none"
end run
APPLESCRIPT
}

focus_safari() {
  osascript - "$PREFIX" <<'APPLESCRIPT'
on run argv
	set prefix to item 1 of argv
	tell application "Safari"
		repeat with w in windows
			repeat with t in tabs of w
				if URL of t starts with prefix then
					set current tab of w to t
					set index of w to 1
					activate
					return "ok"
				end if
			end repeat
		end repeat
	end tell
	return "none"
end run
APPLESCRIPT
}

if running "Dia" && [[ $(focus_dia 2>/dev/null) == ok ]]; then exit 0; fi
for browser in "Google Chrome" "Arc" "Brave Browser" "Microsoft Edge"; do
  if running "$browser" && [[ $(focus_chromium "$browser" 2>/dev/null) == ok ]]; then exit 0; fi
done
if running "Safari" && [[ $(focus_safari 2>/dev/null) == ok ]]; then exit 0; fi
exit 1
