import { Gtk } from "ags/gtk4"
import { SliderRow } from "../utils/helpers"
import { volPct } from "../../state"
import { execAsync } from "ags/process"

export function Sliders() {
  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(6)
  box.add_css_class("cc-sliders")

  let briScale: Gtk.Scale | null = null
  let briLbl: Gtk.Label | null = null

  const vol = SliderRow(
    "◑",
    "cc-vol-icon",
    () => 50,
    (v) => {
      execAsync(["bash", "-c", `wpctl set-volume @DEFAULT_SINK@ ${v}%`]).catch(
        () => {},
      )
    },
  )
  box.append(vol.row)

  const bri = SliderRow(
    "✺",
    "cc-bri-icon",
    () => 50,
    (v) => {
      execAsync(["bash", "-c", `brightnessctl set ${v}%`]).catch(() => {})
    },
  )
  briScale = bri.scale
  briLbl = bri.valLbl
  box.append(bri.row)

  vol.setValueSilent(parseInt(volPct.get().trim()) || 0)
  volPct.subscribe(() => vol.setValueSilent(parseInt(volPct.get().trim()) || 0))

  execAsync([
    "bash",
    "-c",
    "d=$(ls /sys/class/backlight | head -1); echo $(cat /sys/class/backlight/$d/brightness) $(cat /sys/class/backlight/$d/max_brightness)",
  ])
    .then((s: string) => {
      const [cur, max] = s.trim().split(" ").map(Number)
      if (max) {
        const v = Math.round((cur / max) * 100)
        briScale?.set_value(v)
        briLbl?.set_label(`${v}`)
      }
    })
    .catch(() => {})

  return box
}
