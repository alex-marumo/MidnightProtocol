import GLib from "gi://GLib"
import Gio from "gi://Gio"
import { execAsync } from "ags/process"
import type { ProviderResult } from "../launcher"

let commands: string[] = []
let loaded = false

function loadCommands() {
  if (loaded) return

  const path = GLib.getenv("PATH") || ""
  const dirs = path.split(":")

  const found = new Set<string>()

  for (const dir of dirs) {
    try {
      const file = Gio.File.new_for_path(dir)
      const enumerator = file.enumerate_children(
        "standard::name",
        Gio.FileQueryInfoFlags.NONE,
        null,
      )

      let info
      while ((info = enumerator.next_file(null))) {
        found.add(info.get_name())
      }
    } catch {}
  }

  commands = [...found]
  loaded = true
}

function fuzzyScore(query: string, target: string) {
  query = query.toLowerCase()
  target = target.toLowerCase()

  let qi = 0
  let score = 0

  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (query[qi] === target[i]) {
      qi++
      score += 10 + qi * 2
    }
  }

  return qi === query.length ? score : -Infinity
}

export default function runProvider(query: string): ProviderResult[] {
  loadCommands()

  const q = query.trim()
  if (!q) return []

  const [cmd] = q.split(" ")

  const matches = commands
    .map((c) => ({ cmd: c, score: fuzzyScore(cmd, c) }))
    .filter((r) => r.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  const results: ProviderResult[] = matches.map((r) => ({
    title: r.cmd,
    subtitle: `Run: ${q}`,
    icon: "utilities-terminal-symbolic",
    score: r.score + 40,
    action: () => execAsync(["bash", "-c", q]).catch(() => {}),
  }))

  // fallback: run arbitrary command
  results.push({
    title: `Run "${q}"`,
    subtitle: "Execute shell command",
    icon: "utilities-terminal-symbolic",
    score: 10,
    action: () => execAsync(["bash", "-c", q]).catch(() => {}),
  })

  return results
}
