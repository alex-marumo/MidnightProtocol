import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import type { ProviderResult } from "../launcher"
import { getRanking } from "../ranking"

interface AppEntry {
  name: string
  description: string
  exec: string
  icon: string
  terminal: boolean
  launch: () => void
}

let apps: AppEntry[] = []
let loaded = false

const monitor = Gio.AppInfoMonitor.get()
monitor.connect("changed", () => {
  loaded = false
})

function cleanExec(exec: string) {
  return exec.replace(/%[fFuUdDnNickvm]/g, "").trim()
}

function getIcon(ai: Gio.AppInfo): string {
  const icon = ai.get_icon()
  if (!icon) return "application-x-executable"
  if ("get_names" in icon) return icon.get_names()[0]
  return "application-x-executable"
}

function binaryExists(exec: string): boolean {
  const bin = exec.split(" ")[0]
  if (!bin) return false
  // full path check
  if (bin.startsWith("/"))
    return GLib.file_test(bin, GLib.FileTest.IS_EXECUTABLE)
  // PATH check
  return GLib.find_program_in_path(bin) !== null
}

function loadApps() {
  if (loaded) return

  const all = Gio.AppInfo.get_all()

  apps = all
    .filter((a) => a.should_show())
    .map((ai) => {
      const cmdline = cleanExec(ai.get_commandline() || "")
      const exec = cleanExec(ai.get_executable() || "")
      const cmd = cmdline || exec

      // filter ghost apps
      if (!binaryExists(cmd)) return null

      return {
        name: ai.get_name() || "Unknown",
        description: ai.get_description() || "",
        exec: cmd,
        terminal: ai.should_launch_in_terminal?.() || false,
        icon: getIcon(ai),
        launch: () => {
          if (cmd) execAsync(["bash", "-c", cmd]).catch(() => {})
        },
      }
    })
    .filter(Boolean) as AppEntry[]

  loaded = true
}

function fuzzyScore(query: string, target: string) {
  query = query.toLowerCase()
  target = target.toLowerCase()

  let qi = 0,
    score = 0,
    streak = 0

  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (query[qi] === target[i]) {
      qi++
      streak++
      score += 10 + streak * 6
    } else {
      streak = 0
      score -= 1
    }
  }

  if (qi !== query.length) return -Infinity
  return score + (120 - target.length)
}

export default function appsProvider(query: string): ProviderResult[] {
  loadApps()

  query = query.trim()

  if (!query) {
    return apps
      .map((app) => ({ app, score: getRanking(app.name) || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => ({
        title: r.app.name,
        subtitle: r.app.description || undefined,
        icon: r.app.icon,
        score: r.score,
        action: r.app.launch,
      }))
  }

  const results = apps
    .map((app) => ({
      app,
      score: Math.max(
        fuzzyScore(query, app.name),
        fuzzyScore(query, app.exec),
        fuzzyScore(query, app.description),
      ),
    }))
    .filter((r) => r.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  return results.map((r) => ({
    title: r.app.name,
    subtitle: r.app.exec || r.app.description,
    icon: r.app.icon,
    score: r.score + (getRanking(r.app.name) || 0),
    executable: r.app.exec,
    action: r.app.launch,
  }))
}
