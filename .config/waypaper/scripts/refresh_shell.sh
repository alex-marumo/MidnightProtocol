#!/usr/bin/env bash
# refresh_shell.sh — waypaper post_command
# wallpaper → matugen → ags reload → safe fallback pipeline

set -e

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

WALLPAPER=$(grep '^wallpaper' ~/.config/waypaper/config.ini | head -1 |
  sed 's/wallpaper = //' | sed "s|~|$HOME|" | xargs)

[[ -z "$WALLPAPER" || ! -f "$WALLPAPER" ]] && exit 1

# current wallpaper symlink (your logic kept)
ln -sf "$WALLPAPER" "$HOME/Pictures/wallpapers/.current_wallpaper"

# -----------------------------
# MATUGEN (ISOLATED EXECUTION)
# -----------------------------
echo "[refresh] running matugen..."

if ! matugen image "$WALLPAPER" --mode dark -t scheme-expressive --source-color-index 0; then
  echo "[refresh] matugen failed — continuing anyway"
fi

# -----------------------------
# HYPR SAFETY RELOAD
# -----------------------------
echo "[refresh] reloading hyprland..."
hyprctl reload >/dev/null 2>&1 || true

# -----------------------------
# AGS HOOK (if you already have it)
# -----------------------------
if command -v ags >/dev/null 2>&1; then
  echo "[refresh] restarting ags..."
  ags -q && ags &
fi

exit 0
