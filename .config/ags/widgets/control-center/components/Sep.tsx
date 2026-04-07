import { Gtk } from "ags/gtk4"

export function Sep() {
  const s = new Gtk.Separator()
  s.set_orientation(Gtk.Orientation.HORIZONTAL)
  s.add_css_class("cc-sep")
  return s
}
