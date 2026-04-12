#!/usr/bin/env bash
# refresh_shell.sh — waypaper post_command
# Runs matugen → writes colors.scss → reload-ags.sh picks up the change

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

WALLPAPER=$(grep '^wallpaper' ~/.config/waypaper/config.ini | head -1 |
  sed 's/wallpaper = //' | sed "s|~|$HOME|" | xargs)
[[ -z "$WALLPAPER" || ! -f "$WALLPAPER" ]] && exit 1

matugen image "$WALLPAPER" --mode dark -t scheme-expressive --source-color-index 0
true
