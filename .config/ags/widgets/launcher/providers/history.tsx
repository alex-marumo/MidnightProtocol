import { ProviderResult } from "../launcher"
import Gio from "gi://Gio"
import GLib from "gi://GLib"

interface HistoryEntry {
  title: string
  subtitle?: string
  icon?: string
  executable?: string
  score: number
}

const CACHE_PATH = GLib.get_user_cache_dir() + "/ags/launcher-history.json"
let history: HistoryEntry[] = []

// Load history immediately
try {
  const file = Gio.File.new_for_path(CACHE_PATH)
  if (file.query_exists(null)) {
    const [, contents] = file.load_contents(null)
    history = JSON.parse(new TextDecoder().decode(contents))
  }
} catch (e) {
  console.log("No existing history found or file corrupted.")
  history = []
}

function saveHistory() {
  try {
    const file = Gio.File.new_for_path(CACHE_PATH)
    const dir = file.get_parent()
    if (dir && !dir.query_exists(null)) dir.make_directory_with_parents(null)

    // Use synchronous replace_contents to prevent data loss on launcher close
    const jsonString = JSON.stringify(history, null, 2)
    file.replace_contents(
      jsonString,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    )
  } catch (e) {
    console.error("Failed to save history:", e)
  }
}

export function recordHistory(
  item: ProviderResult & { executable?: string; iconName?: string },
) {
  const existing = history.find(
    (h) => h.title === item.title && h.subtitle === item.subtitle,
  )

  if (existing) {
    existing.score += 1
    // Update fields if they were missing
    if (item.executable) existing.executable = item.executable
    if (item.iconName || item.icon) existing.icon = item.iconName || item.icon
  } else {
    history.unshift({
      title: item.title,
      subtitle: item.subtitle || "",
      // Fallback to a generic icon if nothing is found
      icon: item.iconName || item.icon || "application-x-executable",
      executable: item.executable || "",
      score: 1,
    })
  }

  history.sort((a, b) => b.score - a.score)
  if (history.length > 30) history.pop()

  saveHistory()
}

export default function historyProvider(query: string): ProviderResult[] {
  const q = query.toLowerCase()
  const filtered = query
    ? history.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.subtitle?.toLowerCase().includes(q),
      )
    : history

  return filtered.slice(0, 8).map((h) => ({
    title: h.title,
    subtitle: h.subtitle,
    // Use iconName here to ensure the launcher's widget finds the icon
    iconName: h.icon,
    score: h.score,
    action: () => {
      // Re-record to bump score
      recordHistory({ ...h, iconName: h.icon } as any)

      const cmd = h.executable || h.subtitle || h.title.toLowerCase()
      if (cmd.startsWith("http")) {
        GLib.spawn_command_line_async(`xdg-open ${cmd}`)
      } else if (cmd.startsWith("/")) {
        GLib.spawn_command_line_async(`xdg-open "${cmd}"`)
      } else {
        GLib.spawn_command_line_async(cmd)
      }
    },
  }))
}
