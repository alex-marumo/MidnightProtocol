#!/usr/bin/env bash

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export PULSE_RUNTIME_PATH="/run/user/$(id -u)/pulse"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

WALLPAPER=$(swww query | grep -oP 'image: \K.*' | head -1)
[[ -z "$WALLPAPER" || ! -f "$WALLPAPER" ]] && exit 1

# generate colors directly
python3 "$HOME/.config/ags/generate-colors.py" "$WALLPAPER"

# sync hyprlock background
awk -v wp="$WALLPAPER" '
  /^\$background_image/ { print "$background_image = " wp; next }
  { print }
' "$HOME/.config/hypr/hyprlock/colors.conf" >/tmp/hyprlock-colors.tmp &&
  mv /tmp/hyprlock-colors.tmp "$HOME/.config/hypr/hyprlock/colors.conf"

sleep 0.3
ags quit 2>/dev/null
sleep 0.1
ags run "$HOME/.config/ags/app.ts" &
