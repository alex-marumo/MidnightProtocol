import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import { PillToggle } from "../utils/helpers"
import { wifiOn, btOn, toggleWifi, toggleBt } from "../../state"
import { nightRefs } from "../lib/nightlight"
import { launchHyprsunset } from "../lib/nightlight"
import { saveState, loadState } from "../lib/persistence"

export function Toggles() {
  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(6)
  box.add_css_class("cc-toggles")

  // WiFi
  const wifiPill = PillToggle({
    icon: "󰤭",
    iconActive: "󰤨",
    label: "Wi-Fi",
    active: wifiOn.get().trim() === "1",
    onToggle: () => toggleWifi(),
    onLabelClick: () =>
      execAsync(["bash", "-c", "kitty --class floating_kitty nmtui"]).catch(
        () => {},
      ),
  })
  wifiOn.subscribe(() => wifiPill.setActive(wifiOn.get().trim() === "1"))

  execAsync([
    "bash",
    "-c",
    "nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d: -f2",
  ])
    .then((s: string) => {
      if (s.trim()) wifiPill.lbl.set_label(s.trim())
    })
    .catch(() => {})

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    execAsync([
      "bash",
      "-c",
      "nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d: -f2",
    ])
      .then((s: string) => wifiPill.lbl.set_label(s.trim() || "Wi-Fi"))
      .catch(() => {})
    return GLib.SOURCE_CONTINUE
  })

  // Bluetooth
  const btPill = PillToggle({
    icon: "󰂲",
    iconActive: "󰂯",
    label: "Bluetooth",
    active: btOn.get().trim() === "1",
    onToggle: () => toggleBt(),
    onLabelClick: () =>
      execAsync(["bash", "-c", "kitty --class floating_kitty bluetui"]).catch(
        () => {},
      ),
  })
  btOn.subscribe(() => btPill.setActive(btOn.get().trim() === "1"))

  execAsync([
    "bash",
    "-c",
    "bluetoothctl info | grep 'Name:' | head -1 | cut -d' ' -f2-",
  ])
    .then((s: string) => {
      if (s.trim()) btPill.lbl.set_label(s.trim())
    })
    .catch(() => {})

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    execAsync([
      "bash",
      "-c",
      "bluetoothctl info | grep 'Name:' | head -1 | cut -d' ' -f2-",
    ])
      .then((s: string) => btPill.lbl.set_label(s.trim() || "Bluetooth"))
      .catch(() => {})
    return GLib.SOURCE_CONTINUE
  })

  // Night Light (uses shared refs)
  const nightPillLocal = PillToggle({
    icon: "󰽤",
    iconActive: "☄",
    label: nightRefs.isNightLightAuto ? "Night (Auto)" : "Night Light",
    active: false,
    onToggle: (v) => {
      if (v) {
        const val = nightRefs.nightSlider
          ? nightRefs.nightSlider.get_value()
          : loadState().val
        const s = loadState()
        if (nightRefs.isNightLightAuto && s.lat != null && s.lon != null) {
          launchHyprsunset(val, s.lat, s.lon)
        } else {
          launchHyprsunset(val)
        }
      } else {
        nightRefs.isNightLightAuto = false
        saveState(
          false,
          nightRefs.nightSlider
            ? nightRefs.nightSlider.get_value()
            : loadState().val,
        )
        nightRefs.nightPill.lbl.set_label("Night Light")
        execAsync("pkill hyprsunset").catch(() => {})
      }
    },
    onLabelClick: () =>
      nightRefs.bottomStack?.set_visible_child_name("tab-nightlight"),
  })
  nightRefs.nightPill = nightPillLocal

  execAsync(["bash", "-c", "pgrep hyprsunset && echo 1 || echo 0"])
    .then((v) => nightRefs.nightPill.setActive(v.trim() === "1"))
    .catch(() => {})

  // Stay Awake
  const awakePill = PillToggle({
    icon: "󰒲",
    iconActive: "󰒳",
    label: "Stay Awake",
    active: false,
    onToggle: (v) =>
      execAsync([
        "bash",
        "-c",
        v
          ? "systemd-inhibit --what=idle sleep infinity &"
          : "pkill -f 'systemd-inhibit'",
      ]).catch(() => {}),
    onLabelClick: () => {},
  })

  const row1 = new Gtk.Box()
  row1.set_orientation(Gtk.Orientation.HORIZONTAL)
  row1.set_spacing(6)
  wifiPill.pill.set_hexpand(true)
  btPill.pill.set_hexpand(true)
  row1.append(wifiPill.pill)
  row1.append(btPill.pill)

  const row2 = new Gtk.Box()
  row2.set_orientation(Gtk.Orientation.HORIZONTAL)
  row2.set_spacing(6)
  nightPillLocal.pill.set_hexpand(true)
  awakePill.pill.set_hexpand(true)
  row2.append(nightPillLocal.pill)
  row2.append(awakePill.pill)

  box.append(row1)
  box.append(row2)

  return box
}
