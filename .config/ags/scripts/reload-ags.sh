#!/usr/bin/env bash

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export PULSE_RUNTIME_PATH="/run/user/$(id -u)/pulse"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

LOCKFILE="/tmp/reload-ags.lock"

[[ -f "$LOCKFILE" ]] && exit 0
touch "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

sleep 0.5

WALLPAPER=$(swww query | grep -oP 'image: \K.*' | head -1)
[[ -z "$WALLPAPER" || ! -f "$WALLPAPER" ]] && exit 1

# Run matugen
matugen image "$WALLPAPER" --mode dark --type scheme-expressive --source-color-index 0

# Update hyprlock background image
awk -v wp="$WALLPAPER" '
  /^\$background_image/ { print "$background_image = " wp; next }
  { print }
' "$HOME/.config/hypr/hyprlock/colors.conf" >/tmp/hyprlock-colors.tmp &&
  mv /tmp/hyprlock-colors.tmp "$HOME/.config/hypr/hyprlock/colors.conf"

sleep 0.3
ags quit 2>/dev/null
sleep 0.2
ags run "$HOME/.config/ags/app.ts" &
