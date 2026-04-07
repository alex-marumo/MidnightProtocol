import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { togglePanel } from "./ControlCenter"

export default function ControlCenterToggle() {
  const box = new Gtk.Box()
  box.add_css_class("cc-strip-box")
  box.set_size_request(45, 2)

  const click = new Gtk.GestureClick()
  click.connect("pressed", togglePanel)
  box.add_controller(click)

  return (
    <window
      name="cc-toggle"
      cssClasses={["cc-strip-window"]}
      visible
      application={app}
      layer={Astal.Layer.OVERLAY}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      exclusivity={Astal.Exclusivity.ON_DEMAND}
    >
      {box}
    </window>
  )
}
