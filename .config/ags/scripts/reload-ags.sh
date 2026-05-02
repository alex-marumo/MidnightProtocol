#!/usr/bin/env bash
# reload-ags.sh — watches colors.scss, restarts AGS with new colors
# Triggered indirectly by waypaper → refresh_shell.sh → matugen

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-1}"

source /proc/$(pgrep -u "$USER" Hyprland | head -1)/environ 2>/dev/null | tr '\0' '\n' | grep -E 'WAYLAND|XDG|DBUS|DISPLAY' | while IFS='=' read -r k v; do export "$k=$v"; done
until [[ -f ~/.config/ags/colors.scss ]]; do sleep 0.5; done

while read -r; do
  ags quit 2>/dev/null
  sleep 0.3
  ags run --gtk 4 &
  sleep 0.5
  while read -r -t 0.1; do :; done
done < <(inotifywait -m -e close_write ~/.config/ags/colors.scss 2>/dev/null)
