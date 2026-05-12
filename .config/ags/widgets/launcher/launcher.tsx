import { Gtk, Astal } from "ags/gtk4"
import app from "ags/gtk4/app"
import { queryLauncher, execute } from "./launcherlogic"
import Pango from "gi://Pango"

export default function Launcher() {
  let debounceTimer: number | null = null
  let activeTab = "history"

  const FIXED_WIDTH = 540
  const FIXED_HEIGHT = 460

  const list = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["launcher-list"],
  })

  const scrolled = new Gtk.ScrolledWindow({
    vexpand: true,
    hscrollbar_policy: Gtk.PolicyType.NEVER,
    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    propagate_natural_height: false,
    min_content_height: 280,
    max_content_height: 320,
    css_classes: ["launcher-scrolled"],
  })
  scrolled.set_child(list)

  const tabBar = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    css_classes: ["launcher-tabs"],
    homogeneous: true,
    spacing: 2,
  })

  const tabs = [
    { id: "history", label: "󰋚" },
    { id: "apps", label: "󰀻" },
    { id: "run", label: "󰆍" },
    { id: "files", label: "󰈙" },
    { id: "web", label: "󰖟" },
    { id: "windows", label: "󰓩" },
    { id: "calc", label: "󰃬" },
  ]

  const tabButtons: Record<string, Gtk.Button> = {}

  tabs.forEach(({ id, label }) => {
    const btn = new Gtk.Button({ label, css_classes: ["tab-btn"] })
    btn.connect("clicked", () => {
      activeTab = id
      Object.values(tabButtons).forEach((b) => b.set_css_classes(["tab-btn"]))
      btn.set_css_classes(["tab-btn", "tab-active"])
      updateList(searchEntry.text)
    })
    tabButtons[id] = btn
    tabBar.append(btn)
  })

  const updateList = (text: string = "") => {
    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(async () => {
      try {
        const results = await queryLauncher(text, activeTab)
        console.log(
          `[updateList] tab="${activeTab}" query="${text}" got ${results.length} results`,
        )

        let child = list.get_first_child()
        while (child) {
          list.remove(child)
          child = list.get_first_child()
        }

        // Hard limit
        results.slice(0, 14).forEach((item) => {
          const btn = new Gtk.Button({ css_classes: ["launcher-item"] })
          btn.connect("clicked", () => {
            execute(item)
            app.get_window("launcher")?.set_visible(false)
          })

          const row = new Gtk.Box({ spacing: 12 })
          const img = new Gtk.Image({
            icon_name: item.icon || "system-run-symbolic",
            pixel_size: 26,
          })

          const labels = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            hexpand: true,
          })

          const titleLabel = new Gtk.Label({
            label: item.title,
            css_classes: ["launcher-title"],
            xalign: 0,
            hexpand: true,
            ellipsize: Pango.EllipsizeMode.END,
            max_width_chars: 1,
          })

          labels.append(titleLabel)

          if (item.subtitle) {
            const subtitleLabel = new Gtk.Label({
              label: item.subtitle,
              css_classes: ["launcher-subtitle"],
              xalign: 0,
              hexpand: true,
              ellipsize: Pango.EllipsizeMode.END,
              max_width_chars: 1,
            })
            labels.append(subtitleLabel)
          }

          row.append(img)
          row.append(labels)
          btn.set_child(row)
          list.append(btn)
        })
      } catch (err) {
        console.error("Launcher query failed:", err)
        // Clear list on error
        let child = list.get_first_child()
        while (child) {
          list.remove(child)
          child = list.get_first_child()
        }
      }
    }, 60) as unknown as number
  }

  const searchEntry = new Gtk.Entry({
    placeholder_text: "Search...",
    hexpand: true,
    css_classes: ["launcher-entry"],
  })

  searchEntry.connect("changed", (self) => updateList(self.text))
  searchEntry.connect("activate", async () => {
    try {
      const results = await queryLauncher(searchEntry.text, activeTab)
      if (results[0]) execute(results[0])
      app.get_window("launcher")?.set_visible(false)
    } catch (err) {
      console.error("Launcher execute failed:", err)
    }
  })

  const mainBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["caelestia-pod", "cyber-launcher"],
    widthRequest: FIXED_WIDTH,
    heightRequest: FIXED_HEIGHT,
  })

  mainBox.append(tabBar)
  mainBox.append(scrolled)
  mainBox.append(searchEntry)

  const win = new Astal.Window({
    name: "launcher",
    application: app,
    visible: false,
    keymode: Astal.Keymode.ON_DEMAND,
    layer: Astal.Layer.TOP,
    anchor: Astal.WindowAnchor.BOTTOM,
    resizable: false,
    defaultWidth: FIXED_WIDTH,
    defaultHeight: FIXED_HEIGHT,
    css_classes: ["launcher-window"],
  })

  win.set_child(mainBox)

  const screen = win.get_screen?.()
  if (screen) {
    const visual = screen.get_rgba_visual?.()
    if (visual) win.set_visual(visual)
  }

  win.connect("notify::visible", () => {
    if (win.visible) {
      activeTab = "history"
      Object.values(tabButtons).forEach((b) => b.set_css_classes(["tab-btn"]))
      tabButtons["history"].set_css_classes(["tab-btn", "tab-active"])

      searchEntry.set_text("")
      searchEntry.grab_focus()
      updateList("")
    }
  })

  return win
}
