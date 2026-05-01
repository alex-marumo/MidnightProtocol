import { createPoll } from "ags/time"
import { execAsync } from "ags/process"

export const keyboard = createPoll("EN", 3000, [
  "bash",
  "-c",
  "hyprctl devices -j | python3 -c \"import sys,json; d=json.load(sys.stdin); kbd=[k for k in d.get('keyboards',[]) if k.get('main')]; print(kbd[0]['active_keymap'][:2].upper() if kbd else 'EN')\"",
])

export const wifiOn = createPoll("1", 500, [
  "bash",
  "-c",
  "nmcli radio wifi | grep -q enabled && echo 1 || echo 0",
])

export const btOn = createPoll("1", 500, [
  "bash",
  "-c",
  "bluetoothctl show | grep -q 'Powered: yes' && echo 1 || echo 0",
])

export const muted = createPoll("0", 1000, [
  "bash",
  "-c",
  "wpctl get-volume @DEFAULT_SINK@ | grep -c MUTED || echo 0",
])

export const volPct = createPoll("50", 1000, [
  "bash",
  "-c",
  "wpctl get-volume @DEFAULT_SINK@ | grep -oP '[0-9]+\\.[0-9]+' | head -1 | awk '{v=$1*100; printf \"%.0f\", (v>100?100:v)}' || echo 50",
])

export const wifiSsid = createPoll("—", 5000, [
  "bash",
  "-c",
  "nmcli -t -f ACTIVE,SSID dev wifi 2>/dev/null | grep '^yes:' | cut -d: -f2 | head -1 || echo '—'",
])

export const btDevice = createPoll("—", 5000, [
  "bash",
  "-c",
  "bluetoothctl devices Connected 2>/dev/null | grep -v 'controller' | head -1 | cut -d' ' -f3- || echo '—'",
])

// ── Actions ───────────────────────────────────────────────────
export const toggleWifi = () =>
  execAsync([
    "bash",
    "-c",
    wifiOn.get().trim() === "1"
      ? "nmcli radio wifi off"
      : "nmcli radio wifi on",
  ]).catch(() => {})

export const toggleBt = async () => {
  const newState = btOn.get().trim() === "1" ? "off" : "on"
  await execAsync(["bash", "-c", `~/.config/hypr/scripts/bt-persist.sh ${newState}`]).catch(() => {})
  btOn.poll()
}

export const toggleMute = () =>
  execAsync(["wpctl", "set-mute", "@DEFAULT_SINK@", "toggle"]).catch(() => {})
