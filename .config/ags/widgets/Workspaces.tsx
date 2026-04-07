import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

const Hyprland = (await import("gi://AstalHyprland")).default.get_default()

const kanji = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]

export default function Workspaces() {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 3,
    cssClasses: ["workspaces"],
    halign: Gtk.Align.CENTER,
  })

  const buttons: Gtk.Button[] = []

  function update() {
    const focused = Hyprland.focusedWorkspace?.id ?? 1
    const workspaces = Hyprland.workspaces ?? []

    buttons.forEach((btn, i) => {
      const id = i + 1
      const ws = workspaces.find((w: any) => w.id === id)
      const isOccupied = ws && (ws.clients?.length ?? 0) > 0
      const isActive = focused === id

      btn.set_css_classes(
        [
          "ws-btn",
          isActive ? "active" : "",
          isOccupied && !isActive ? "occupied" : "",
        ].filter(Boolean),
      )
    })
  }

  // Create 10 workspace buttons
  for (let i = 0; i < 10; i++) {
    const id = i + 1
    const btn = new Gtk.Button({ halign: Gtk.Align.CENTER })
    btn.add_css_class("ws-btn")

    const lbl = new Gtk.Label({ label: kanji[i] })
    btn.set_child(lbl)

    btn.connect("clicked", () => {
      Hyprland.dispatch("workspace", id.toString())
    })

    box.append(btn)
    buttons.push(btn)
  }

  // Initial + live updates
  update()
  Hyprland.connect("notify::focused-workspace", update)
  Hyprland.connect("notify::workspaces", update)

  // Force refresh every 3s as backup
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
    update()
    return GLib.SOURCE_CONTINUE
  })

  return box
}
