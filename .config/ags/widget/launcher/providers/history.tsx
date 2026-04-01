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

try {
  const file = Gio.File.new_for_path(CACHE_PATH)
  const [success, contents] = file.load_contents(null)
  if (success) {
    history = JSON.parse(new TextDecoder().decode(contents))
  }
} catch {
  console.log("No existing history found.")
}

function saveHistory() {
  try {
    const contents = new TextEncoder().encode(JSON.stringify(history, null, 2))
    const file = Gio.File.new_for_path(CACHE_PATH)
    const dir = file.get_parent()
    if (dir && !dir.query_exists(null)) dir.make_directory_with_parents(null)
    file.replace_contents_async(contents, null, false, 0, null, null)
  } catch (e) {
    console.error("Failed to save history:", e)
  }
}

function isDeadEntry(h: HistoryEntry): boolean {
  // check executable field first, then subtitle if it looks like a path
  const cmd = h.executable || (h.subtitle?.startsWith("/") ? h.subtitle : null)
  if (!cmd) return false
  const bin = cmd.split(" ")[0]
  return !GLib.file_test(bin, GLib.FileTest.IS_EXECUTABLE)
}

export function recordHistory(item: ProviderResult & { executable?: string }) {
  const existing = history.find(
    (h) => h.title === item.title && h.subtitle === item.subtitle,
  )

  if (existing) {
    existing.score += 1
    if (item.executable) existing.executable = item.executable
  } else {
    history.unshift({
      title: item.title,
      subtitle: item.subtitle,
      icon: item.icon,
      executable: item.executable,
      score: 1,
    })
  }

  history.sort((a, b) => b.score - a.score)
  if (history.length > 30) history.pop()
  saveHistory()
}

export default function historyProvider(query: string): ProviderResult[] {
  const q = query.toLowerCase()

  const live = history.filter((h) => !isDeadEntry(h))

  const results = query
    ? live.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.subtitle?.toLowerCase().includes(q),
      )
    : live

  return results.slice(0, 8).map((h) => ({
    title: h.title,
    subtitle: h.subtitle,
    icon: h.icon,
    score: h.score,
    action: () => {
      if (h.executable) {
        // run the stored app command directly
        GLib.spawn_command_line_async(h.executable)
      } else if (h.subtitle?.startsWith("http")) {
        GLib.spawn_command_line_async(`xdg-open ${h.subtitle}`)
      } else if (h.subtitle?.startsWith("/")) {
        // actual file, not a binary
        GLib.spawn_command_line_async(`xdg-open "${h.subtitle}"`)
      } else {
        GLib.spawn_command_line_async(h.title.toLowerCase())
      }
    },
  }))
}
