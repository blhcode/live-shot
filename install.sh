#!/usr/bin/env bash
# Installs (or updates) Live Shot for the current user. Run again after changing the game.
set -e
cd "$(dirname "$(readlink -f "$0")")"

[ -d node_modules ] || npm install
npx vite build >/dev/null

DEST="$HOME/.local/share/live-shot"
rm -rf "$DEST/app"
mkdir -p "$DEST" "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/scalable/apps"
cp -r dist "$DEST/app"
install -m 755 packaging/live-shot "$HOME/.local/bin/live-shot"
cp packaging/live-shot.svg "$HOME/.local/share/icons/hicolor/scalable/apps/live-shot.svg"

cat > "$HOME/.local/share/applications/live-shot.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Live Shot
Comment=Be the camera operator at a live concert
Exec=$HOME/.local/bin/live-shot
Icon=live-shot
Terminal=false
Categories=Game;
Keywords=camera;concert;recording;
EOF

update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
echo "Installed Live Shot to $DEST"
