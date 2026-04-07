import { Astal, Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

type OSDType = "volume" | "brightness" | "mute"

let currentType: OSDType = "volume"
let currentValue = 0
let isMuted = false
let hideTimer = 0
let iconLblRef: Gtk.Label | null = null
let nameLblRef: Gtk.Label | null = null
let valLblRef: Gtk.Label | null = null
let winRef: any = null

function getIcon(): string {
  if (currentType === "brightness") return "󰃞"
  if (isMuted) return "󰝟"
  if (currentValue < 30) return "󰕿"
  if (currentValue < 70) return "󰖀"
  return "󰕾"
}

function getName(): string {
  if (currentType === "brightness") return "Brightness"
  return "Volume"
}

function show(type: OSDType, value: number, muted = false) {
  currentType = type
  currentValue = value
  isMuted = muted

  iconLblRef?.set_label(getIcon())
  nameLblRef?.set_label(getName())
  valLblRef?.set_label(`${value}`)

  winRef?.set_visible(true)
  if (hideTimer) {
    GLib.source_remove(hideTimer)
    hideTimer = 0
  }
  hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
    winRef?.set_visible(false)
    hideTimer = 0
    return GLib.SOURCE_REMOVE
  })
}

export default function OSD() {
  const icon = new Gtk.Label()
  icon.add_css_class("osd-icon")
  icon.set_label("󰕾")
  iconLblRef = icon

  const name = new Gtk.Label()
  name.add_css_class("osd-name")
  name.set_label("Volume")
  nameLblRef = name

  const val = new Gtk.Label()
  val.add_css_class("osd-val")
  val.set_label("0")
  valLblRef = val

  const pill = new Gtk.Box()
  pill.set_orientation(Gtk.Orientation.HORIZONTAL)
  pill.set_spacing(8)
  pill.set_halign(Gtk.Align.CENTER)
  pill.set_valign(Gtk.Align.CENTER)
  pill.add_css_class("osd-pill")
  pill.append(icon)
  pill.append(name)
  pill.append(val)

  const w = (
    <window
      cssClasses={["osd-window"]}
      visible={false}
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP}
      marginTop={16}
      exclusivity={Astal.Exclusivity.IGNORE}
    >
      {pill}
    </window>
  )
  winRef = w
  ;(async () => {
    // Volume
    try {
      const Wp = (await import("gi://AstalWp")).default.get_default()
      const spk = Wp?.audio?.defaultSpeaker
      if (spk) {
        spk.connect("notify::volume", () =>
          show("volume", Math.round(spk.volume * 100), spk.mute),
        )
        spk.connect("notify::mute", () =>
          show("mute", Math.round(spk.volume * 100), spk.mute),
        )
      }
    } catch (_) {}

    // Brightness — poll sysfs every 300ms, only show on change
    try {
      const { execAsync } = await import("ags/process")
      const cmd =
        "d=$(ls /sys/class/backlight | head -1); echo $(cat /sys/class/backlight/$d/brightness) $(cat /sys/class/backlight/$d/max_brightness)"
      let last = -1
      GLib.timeout_add(GLib.PRIORITY_LOW, 300, () => {
        execAsync(["bash", "-c", cmd])
          .then((out) => {
            const [cur, max] = out.trim().split(" ").map(Number)
            if (!max) return
            const pct = Math.round((cur / max) * 100)
            if (pct !== last) {
              last = pct
              show("brightness", pct)
            }
          })
          .catch(() => {})
        return GLib.SOURCE_CONTINUE
      })
    } catch (_) {}
  })()

  return w
}
