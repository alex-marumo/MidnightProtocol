#!/usr/bin/env bash

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export PULSE_RUNTIME_PATH="/run/user/$(id -u)/pulse"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

LOCKFILE="/tmp/reload-ags.lock"

# Exit if already running
[[ -f "$LOCKFILE" ]] && exit 0
touch "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

WALLPAPER=$(swww query | grep -oP 'image: \K.*' | head -1)
[[ -z "$WALLPAPER" || ! -f "$WALLPAPER" ]] && exit 1

wallust run "$WALLPAPER"

awk -v wp="$WALLPAPER" '
  /^\$background_image/ { print "$background_image = " wp; next }
  { print }
' "$HOME/.config/hypr/hyprlock/colors.conf" >/tmp/hyprlock-colors.tmp &&
  mv /tmp/hyprlock-colors.tmp "$HOME/.config/hypr/hyprlock/colors.conf"

sleep 0.3
ags quit 2>/dev/null
sleep 0.1
ags run "$HOME/.config/ags/app.ts" &
