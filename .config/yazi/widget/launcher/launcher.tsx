import { Gtk, Astal } from "ags/gtk4"
import app from "ags/gtk4/app"
import { queryLauncher, execute } from "./launcherlogic"

export default function Launcher() {
  // 1. The Result List
  const list = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["launcher-list"],
  })

  const updateList = async (text: string) => {
    const results = await queryLauncher(text)

    let child = list.get_first_child()
    while (child) {
      list.remove(child)
      child = list.get_first_child()
    }

    results.slice(0, 6).forEach((item) => {
      const btn = new Gtk.Button({ css_classes: ["launcher-item"] })
      btn.connect("clicked", () => {
        execute(item)
        app.get_window("launcher")?.set_visible(false)
      })

      const content = new Gtk.Box({ spacing: 16 })
      const img = new Gtk.Image({
        icon_name: item.icon || "system-run-symbolic",
        pixel_size: 28,
      })

      img.set_margin_start(8)

      const labels = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.CENTER,
      })

      labels.append(
        new Gtk.Label({
          label: item.title,
          css_classes: ["launcher-title"],
          xalign: 0,
        }),
      )

      if (item.subtitle) {
        labels.append(
          new Gtk.Label({
            label: item.subtitle,
            css_classes: ["launcher-subtitle"],
            xalign: 0,
          }),
        )
      }

      content.append(img)
      content.append(labels)
      btn.set_child(content)
      list.append(btn)
    })
  }

  // 2. The Search Entry
  const searchEntry = new Gtk.Entry({
    placeholder_text: 'Type ">" for commands...',
    hexpand: true,
    css_classes: ["launcher-entry"],
  })

  searchEntry.connect("changed", (self) => updateList(self.text))
  searchEntry.connect("activate", async () => {
    const results = await queryLauncher(searchEntry.text)
    if (results[0]) {
      execute(results[0])
      app.get_window("launcher")?.set_visible(false)
    }
  })

  // 3. The Layout Container
  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["caelestia-pod"],
  })

  container.append(list)
  container.append(searchEntry)

  // 4. The Window Shell
  const win = new Astal.Window({
    name: "launcher",
    application: app,
    visible: false,
    keymode: Astal.Keymode.ON_DEMAND,
    layer: Astal.Layer.TOP,
    anchor: Astal.WindowAnchor.BOTTOM,
    css_classes: ["launcher-window"],
  })

  win.set_child(container)

  // Focus and Reset
  win.connect("notify::visible", () => {
    if (win.visible) {
      searchEntry.set_text("")
      searchEntry.grab_focus()
      updateList("")
    }
  })

  return win
}
