import { Gtk } from "ags/gtk4"

export function Calendar() {
  const cal = new Gtk.Calendar()
  cal.add_css_class("cc-calendar")
  return cal
}
