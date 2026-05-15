import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { createState } from "ags"
import { execAsync } from "ags/process"

const HyprlandModule = await import("gi://AstalHyprland")
const Hyprland = HyprlandModule.default.get_default()

const PERSISTENT_APPS = [
  { class: "vesktop", icon: "vesktop", title: "Vesktop" },
  { class: "Steam", icon: "steam", title: "Steam" },
  { class: "qBittorrent", icon: "qbittorrent", title: "qBittorrent" },
  { class: "TelegramDesktop", icon: "telegram", title: "Telegram" },
  { class: "org.keepassxc.KeePassXC", icon: "keepassxc", title: "KeePassXC" },
  {
    class: "org.kde.kdeconnect.app",
    icon: "kdeconnect",
    title: "KDE Connect",
  },
  { class: "protonvpn-app", icon: "proton-vpn-logo", title: "Proton VPN" },
]

// Add a state to track visibility count
export const [activeAppCount, setActiveAppCount] = createState(0)

export default function PersistentApps() {
  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4, // Better spacing for icons
    valign: Gtk.Align.CENTER,
  })
  container.add_css_class("persistent-apps")

  const icons = new Map<string, Gtk.Button>()

  const createIcon = (appDef: any) => {
    const btn = new Gtk.Button({ css_classes: ["persistent-app-btn"] })
    btn.set_child(new Gtk.Image({ icon_name: appDef.icon, pixel_size: 15 }))
    btn.set_tooltip_text(appDef.title)
    btn.set_visible(false)

    btn.connect("clicked", () => {
      const clients = Hyprland.clients || []
      const target = clients.find(
        (c) => c.class?.toLowerCase() === appDef.class.toLowerCase(),
      )

      if (target?.workspace?.id !== undefined) {
        GLib.spawn_command_line_async(
          `hyprctl dispatch workspace ${target.workspace.id}`,
        )
      } else {
        GLib.spawn_command_line_async(appDef.class.toLowerCase())
      }
    })
    return btn
  }

  PERSISTENT_APPS.forEach((appDef) => {
    const btn = createIcon(appDef)
    icons.set(appDef.class, btn)
    container.append(btn)
  })

  const updateIcons = async () => {
    let visibleCount = 0
    const clients = Hyprland.clients || []
    const { execAsync } = await import("ags/process")

    for (const appDef of PERSISTENT_APPS) {
      const btn = icons.get(appDef.class)
      if (!btn) continue

      // Check Hyprland first
      const isRunning = clients.some(
        (c) => c.class?.toLowerCase() === appDef.class.toLowerCase(),
      )

      let shouldShow = isRunning
      if (!shouldShow) {
        try {
          const result = await execAsync([
            "pgrep",
            "-f",
            appDef.class.toLowerCase(),
          ])
          shouldShow = result.trim() !== ""
        } catch {
          shouldShow = false
        }
      }

      btn.set_visible(shouldShow)
      if (shouldShow) visibleCount++
    }
    setActiveAppCount(visibleCount)
    // Hide container if no icons
    container.set_visible(visibleCount > 0)
  }

  if (Hyprland) Hyprland.connect("notify::clients", updateIcons)

  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
    updateIcons().catch(() => {})
    return GLib.SOURCE_CONTINUE
  })

  return container
}
