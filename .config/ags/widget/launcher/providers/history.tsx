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

// 1. Immediate Load from Cache
try {
  const file = Gio.File.new_for_path(CACHE_PATH)
  const [success, contents] = file.load_contents(null)
  if (success) {
    history = JSON.parse(new TextDecoder().decode(contents))
  }
} catch (e) {
  console.log("No existing history found.")
}

// 2. Persistent Save Function
function saveHistory() {
  try {
    const contents = new TextEncoder().encode(JSON.stringify(history, null, 2))
    const file = Gio.File.new_for_path(CACHE_PATH)

    // Ensure parent directory exists
    const dir = file.get_parent()
    if (dir && !dir.query_exists(null)) {
      dir.make_directory_with_parents(null)
    }

    file.replace_contents_async(contents, null, false, 0, null, null)
  } catch (e) {
    console.error("Failed to save history:", e)
  }
}

/**
 * EXPORT: Named export for recording actions in launcherlogic.ts
 */
export function recordHistory(item: ProviderResult) {
  // Use subtitle/title combination to ensure uniqueness
  const existing = history.find(
    (h) => h.title === item.title && h.subtitle === item.subtitle,
  )

  if (existing) {
    existing.score += 1
  } else {
    history.unshift({
      title: item.title,
      subtitle: item.subtitle,
      icon: item.icon,
      score: 1,
    })
  }

  history.sort((a, b) => b.score - a.score)
  if (history.length > 30) history.pop()

  saveHistory()
}

export default function historyProvider(query: string): ProviderResult[] {
  const q = query.toLowerCase()
  const results = query
    ? history.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.subtitle?.toLowerCase().includes(q),
      )
    : history

  return results.slice(0, 8).map((h) => ({
    title: h.title,
    subtitle: h.subtitle,
    icon: h.icon,
    score: h.score,
    // History items should re-trigger their original intent
    action: () => {
      // If it looks like a web URL, open it. If it's a file, open it.
      if (h.subtitle?.startsWith("http")) {
        GLib.spawn_command_line_async(`xdg-open ${h.subtitle}`)
      } else if (h.subtitle?.startsWith("/")) {
        GLib.spawn_command_line_async(`xdg-open ${h.subtitle}`)
      } else {
        GLib.spawn_command_line_async(h.title.toLowerCase())
      }
    },
  }))
}
