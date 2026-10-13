#!/usr/bin/env bash
# Renders the screenshot sources of site/screens/src into site/assets/screens.
# Needs agent-browser and python3 with Pillow. Usage: site/screens/capture.sh
set -euo pipefail

site="$(cd "$(dirname "$0")/.." && pwd)"
out="$site/assets/screens"
port=4798
mkdir -p "$out"

python3 -m http.server "$port" --directory "$site" >/dev/null 2>&1 &
server=$!
trap 'kill "$server"' EXIT
sleep 1

agent-browser set viewport 1440 900 >/dev/null
agent-browser set media light >/dev/null
for name in inbox diff team issues overview; do
  agent-browser open "http://localhost:$port/screens/src/$name.html" >/dev/null
  sleep 1
  agent-browser screenshot "$out/$name.png" >/dev/null
  python3 - "$out/$name.png" "$out/$name.jpg" <<'EOF'
import sys
from PIL import Image
Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=88, optimize=True)
EOF
  rm "$out/$name.png"
  echo "$out/$name.jpg"
done
