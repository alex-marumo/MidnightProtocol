import { Gtk, Gdk } from "ags/gtk4"
import AIChat from "./AIChat"

// ─── Window reference ─────────────────────────────────────────────────────────
let aiWindow: ReturnType<typeof AIChat> | null = null

export default function Logo() {
  const btn = new Gtk.Button({ cssClasses: ["logo-btn"] })
  btn.set_halign(Gtk.Align.CENTER)

  const lbl = new Gtk.Label({
    cssClasses: ["logo"],
    label: "鬼",
    halign: Gtk.Align.CENTER,
  })
  btn.set_child(lbl)

  btn.connect("clicked", () => {
    if (aiWindow) {
      aiWindow.destroy()
      aiWindow = null
    } else {
      const monitor = btn
        .get_display()
        ?.get_monitors()
        ?.get_item(0) as Gdk.Monitor
      if (!monitor) return

      aiWindow = AIChat(monitor)

      aiWindow.connect("destroy", () => {
        aiWindow = null
      })
    }
  })

  return btn
}
