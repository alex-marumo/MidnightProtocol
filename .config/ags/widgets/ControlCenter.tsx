import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { UptimeBar } from "./control-center/components/UptimeBar"
import { Sliders } from "./control-center/components/Sliders"
import { Toggles } from "./control-center/components/Toggles"
import { TopTabs } from "./control-center/components/TopTabs"
import { BottomTabs } from "./control-center/components/BottomTabs"
import { Sep } from "./control-center/components/Sep"

let panelRef: any = null

export function closePanel() {
  panelRef?.set_visible(false)
}

export function togglePanel() {
  if (!panelRef) return
  panelRef.set_visible(!panelRef.get_visible())
}

export default function ControlCenter() {
  const panel = new Gtk.Box()
  panel.set_orientation(Gtk.Orientation.VERTICAL)
  panel.set_spacing(8)
  panel.add_css_class("cc-panel")

  panel.append(UptimeBar())
  panel.append(Sep())
  panel.append(Sliders())
  panel.append(Sep())
  panel.append(Toggles())
  panel.append(Sep())
  panel.append(TopTabs())
  panel.append(Sep())
  panel.append(BottomTabs())

  const overlay = new Gtk.Overlay()
  const backdrop = new Gtk.Box({ hexpand: true, vexpand: true })
  overlay.set_child(backdrop)

  panel.set_halign(Gtk.Align.END)
  panel.set_valign(Gtk.Align.FILL)
  panel.set_margin_top(8)
  panel.set_margin_bottom(8)
  panel.set_margin_end(8)
  overlay.add_overlay(panel)

  const win = (
    <window
      cssClasses={["cc-window"]}
      visible={false}
      layer={Astal.Layer.OVERLAY}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.RIGHT |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT
      }
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
    >
      {overlay}
    </window>
  )

  panelRef = win

  const backdropClick = new Gtk.GestureClick()
  backdropClick.connect("pressed", closePanel)
  backdrop.add_controller(backdropClick)

  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_w: any, keyval: number) => {
    if (keyval === 65307) closePanel()
    return false
  })
  win.add_controller(key)

  return win
}
