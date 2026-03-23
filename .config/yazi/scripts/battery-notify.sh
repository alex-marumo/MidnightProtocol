#!/usr/bin/env bash

export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
export PULSE_RUNTIME_PATH="/run/user/$(id -u)/pulse"
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

until pactl info &>/dev/null; do sleep 1; done

BATTERY=$(upower -e | grep -i battery | head -1)
S="/usr/share/sounds/freedesktop/stereo"

play() { paplay "$1" & }

get_state() {
  upower -i "$BATTERY" | awk '/state:/ {print $2}'
}

get_level() {
  upower -i "$BATTERY" | awk '/percentage:/ {gsub(/%/,"",$2); print int($2)}'
}

# notification replace id
NID=9999

notify() {
  notify-send -r "$NID" "$1" "$2"
}

# debounce guard
LAST_NOTIFY=0
guard() {
  now=$(date +%s)
  ((now - LAST_NOTIFY < 5)) && return 1
  LAST_NOTIFY=$now
  return 0
}

PREV_STATE=$(get_state)

NOTIFIED_15=false
NOTIFIED_5=false
SUSPENDED=false

# ── Battery polling ─────────────────────────
(
  while true; do
    sleep 60

    STATE=$(get_state)
    LEVEL=$(get_level)

    [[ "$STATE" != "discharging" ]] && continue

    if [[ "$LEVEL" -le 3 && "$SUSPENDED" == false ]]; then
      guard || continue
      play "$S/suspend-error.oga"
      notify "🪫 Suspending in 10s" "Battery ${LEVEL}% — plug in to cancel"
      sleep 10
      [[ $(get_state) != "charging" ]] && systemctl suspend
      SUSPENDED=true

    elif [[ "$LEVEL" -le 5 && "$NOTIFIED_5" == false ]]; then
      guard || continue
      play "$S/suspend-error.oga"
      notify "🚨 Critical Battery" "${LEVEL}% — suspends at 3%"
      NOTIFIED_5=true

    elif [[ "$LEVEL" -le 15 && "$NOTIFIED_15" == false ]]; then
      guard || continue
      play "$S/dialog-warning.oga"
      notify "🪫 Low Battery" "${LEVEL}% remaining"
      NOTIFIED_15=true
    fi
  done
) &

# ── Charger events ──────────────────────────
upower --monitor-detail | while read -r line; do

  # Only react to the exact event line
  [[ "$line" != *"changed"* ]] && continue
  [[ "$line" != *"line_power"* ]] && continue

  sleep 1

  STATE=$(get_state)
  LEVEL=$(get_level)

  # fire only on real transitions
  if [[ "$STATE" != "$PREV_STATE" ]]; then

    case "$STATE" in
    charging)
      play "$S/power-plug.oga"
      notify-send -u normal "⚡ Charger Connected" "Battery ${LEVEL}%"
      NOTIFIED_15=false
      NOTIFIED_5=false
      SUSPENDED=false
      ;;
    discharging)
      play "$S/power-unplug.oga"
      notify-send -u normal "🔌 Charger Disconnected" "Battery ${LEVEL}%"
      ;;
    fully-charged)
      play "$S/complete.oga"
      notify-send -u normal "🔋 Fully Charged" "Safe to unplug"
      ;;
    esac

    PREV_STATE="$STATE"

  fi

done
