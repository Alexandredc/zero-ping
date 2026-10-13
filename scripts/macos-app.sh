#!/bin/zsh
# Builds "Zéro Ping.app", a stay-open AppleScript applet that starts the local
# server, opens the inbox (or brings its open tab forward), shows the waiting items as a Dock badge, and stops
# the server when the app quits.
# Usage: scripts/macos-app.sh [destination folder, default ~/Applications]
set -euo pipefail

ROOT="${0:A:h:h}"
DEST="${1:-$HOME/Applications}"
APP="$DEST/Zéro Ping.app"
URL="http://inbox.localhost:4747"
PINGS_URL="http://127.0.0.1:4747/api/pings"
SERVER="$ROOT/scripts/server.sh"
FOCUS="$ROOT/scripts/focus-inbox.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# AppleScript runs shell commands without the user's PATH: freeze the current
# one so pnpm, node, gh and claude resolve as they do in the terminal.
FROZEN_PATH="$PATH"

mkdir -p "$DEST"
cat >"$WORK/app.applescript" <<APPLESCRIPT
use framework "AppKit"
use scripting additions

property serverScript : "$SERVER"
property focusScript : "$FOCUS"
property pingsUrl : "$PINGS_URL"
property badgeSeconds : 15
property inboxUrl : "$URL"
property shellPath : "$FROZEN_PATH"

on server(action)
	return do shell script "export PATH=" & quoted form of shellPath & "; " & quoted form of serverScript & " " & action
end server

on startAndOpen()
	if server("status") is not "running" then
		display notification "Démarrage du serveur…" with title "Zéro Ping"
		try
			server("start")
		on error errText
			display alert "Zéro Ping n'a pas démarré" message errText as critical
			return
		end try
	end if
	-- Reuses the open tab; a new one only when there is none.
	try
		do shell script quoted form of focusScript & " " & quoted form of inboxUrl
	on error
		open location inboxUrl
	end try
end startAndOpen

-- Same rule as the favicon: nothing under 1, "99+" above 99.
on setBadge(label)
	current application's NSApp's dockTile()'s setBadgeLabel:label
end setBadge

on refreshBadge()
	try
		set pings to (do shell script "curl -fsS --max-time 3 " & quoted form of pingsUrl) as integer
	on error
		-- Server stopped or restarting: no stale number.
		my setBadge("")
		return
	end try
	if pings < 1 then
		my setBadge("")
	else if pings > 99 then
		my setBadge("99+")
	else
		my setBadge(pings as text)
	end if
end refreshBadge

on run
	startAndOpen()
	refreshBadge()
end run

on idle
	refreshBadge()
	return badgeSeconds
end idle

on reopen
	startAndOpen()
end reopen

on quit
	my setBadge("")
	try
		server("stop")
	end try
	continue quit
end quit
APPLESCRIPT

rm -rf "$APP"
osacompile -s -o "$APP" "$WORK/app.applescript"

# Icon: render the SVG logo at 1024 px with the transparent margin macOS icons
# keep around their tile, then derive every size iconutil expects.
ICONSET="$WORK/applet.iconset"
mkdir -p "$ICONSET"
qlmanage -t -s 1024 -o "$WORK" "$ROOT/public/logo.svg" >/dev/null 2>&1
RENDER="$WORK/logo.svg.png"
[[ -f $RENDER ]] || RENDER="$ROOT/public/logo-512.png"
SOURCE="$WORK/icon.png"
sips -z 824 824 "$RENDER" --out "$WORK/tile.png" >/dev/null
sips --padToHeightWidth 1024 1024 "$WORK/tile.png" --out "$SOURCE" >/dev/null
for size in 16 32 128 256 512; do
  sips -z $size $size "$SOURCE" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$SOURCE" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns -o "$APP/Contents/Resources/applet.icns" "$ICONSET"

# The default icon in Assets.car would win over applet.icns.
rm -f "$APP/Contents/Resources/Assets.car"
PLIST="$APP/Contents/Info.plist"
plutil -remove CFBundleIconName "$PLIST" 2>/dev/null || true
plutil -replace CFBundleName -string "Zéro Ping" "$PLIST"
plutil -replace CFBundleDisplayName -string "Zéro Ping" "$PLIST"
plutil -replace CFBundleIdentifier -string "app.zeroping.inbox" "$PLIST"

# Editing the bundle breaks the signature osacompile made: sign it again, ad hoc.
codesign --force --deep -s - "$APP"
touch "$APP"
echo "App créée : $APP"
