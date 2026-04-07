import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"

export default function Logo() {
  const btn = new Gtk.Button({ cssClasses: ["logo-btn"] })
  btn.set_halign(Gtk.Align.CENTER)

  const lbl = new Gtk.Label({
    cssClasses: ["logo"],
    label: "鬼",
    halign: Gtk.Align.CENTER,
  })

  btn.set_child(lbl)
  btn.connect("clicked", () =>
    execAsync(["fuzzel", "-show", "drun"]).catch(() => {}),
  )

  return btn
}
