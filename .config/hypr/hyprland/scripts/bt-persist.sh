#!/bin/bash
STATE_FILE="$HOME/.config/bluetooth-state"

if [[ "$1" == "on" ]]; then
  bluetoothctl power on
  echo "on" >"$STATE_FILE"
elif [[ "$1" == "off" ]]; then
  bluetoothctl power off
  echo "off" >"$STATE_FILE"
elif [[ "$1" == "restore" ]]; then
  [[ -f "$STATE_FILE" ]] && bluetoothctl power "$(cat "$STATE_FILE")" || bluetoothctl power off
fi
