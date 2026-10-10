#!/usr/bin/env bash
# Builds (if needed), serves and opens Live Shot in its own browser window.
set -e
cd "$(dirname "$(readlink -f "$0")")"
PORT=5180
URL="http://localhost:$PORT"

[ -d node_modules ] || npm install
if [ ! -d dist ] || [ -n "$(find src index.html -newer dist/index.html -print -quit 2>/dev/null)" ]; then
  npx vite build >/dev/null
fi

if ! curl -s -o /dev/null "$URL"; then
  npx vite preview --port "$PORT" --strictPort >/tmp/live-shot.log 2>&1 &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null' EXIT
  for _ in $(seq 50); do curl -s -o /dev/null "$URL" && break; sleep 0.1; done
fi

# A separate Chrome profile keeps this call blocking until the game window closes.
if flatpak info com.google.Chrome >/dev/null 2>&1; then
  flatpak run com.google.Chrome --app="$URL" --start-maximized \
    --user-data-dir="$HOME/.var/app/com.google.Chrome/live-shot-profile" --autoplay-policy=no-user-gesture-required
elif command -v google-chrome >/dev/null; then
  google-chrome --app="$URL" --start-maximized --user-data-dir="$HOME/.cache/live-shot-profile"
else
  xdg-open "$URL"
  echo "Live Shot is running at $URL — press Ctrl+C here to stop the server."
  wait
fi
