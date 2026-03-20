import Gio from "gi://Gio"
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

function cleanExec(exec: string) {
  return exec.replace(/%[fFuUdDnNickvm]/g, "").trim()
}

function getIcon(ai: Gio.AppInfo): string {
  const icon = ai.get_icon()
  if (!icon) return "application-x-executable"
  if ("get_names" in icon) return icon.get_names()[0]
  return "application-x-executable"
}

function loadApps() {
  if (loaded) return

  const all = Gio.AppInfo.get_all()

  apps = all
    .filter((a) => a.should_show())
    .map((ai) => {
      const exec = cleanExec(ai.get_executable() || "")

      return {
        name: ai.get_name() || "Unknown",
        description: ai.get_description() || "",
        exec,
        terminal: ai.should_launch_in_terminal?.() || false,
        icon: getIcon(ai),

        launch: () => {
          try {
            ai.launch([], null)
          } catch {}
        },
      }
    })

  loaded = true
}

function fuzzyScore(query: string, target: string) {
  query = query.toLowerCase()
  target = target.toLowerCase()

  let qi = 0
  let score = 0
  let streak = 0

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

  // ─────────────────────────
  // Empty query → show best apps
  // ─────────────────────────
  if (!query) {
    return apps
      .map((app) => ({
        app,
        score: getRanking(app.name) || 0,
      }))
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

  // ─────────────────────────
  // Fuzzy search
  // ─────────────────────────
  const results = apps
    .map((app) => {
      const score = Math.max(
        fuzzyScore(query, app.name),
        fuzzyScore(query, app.exec),
        fuzzyScore(query, app.description),
      )

      return { app, score }
    })
    .filter((r) => r.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  return results.map((r) => ({
    title: r.app.name,
    subtitle: r.app.exec || r.app.description,
    icon: r.app.icon,
    score: r.score + (getRanking(r.app.name) || 0),
    action: r.app.launch,
  }))
}
