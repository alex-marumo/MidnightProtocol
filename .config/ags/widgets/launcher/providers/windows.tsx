import { execAsync } from "ags/process"
import type { ProviderResult } from "../launcher"

interface HyprClient {
  address: string
  class: string
  title: string
  workspace: {
    id: number
  }
}

async function getClients(): Promise<HyprClient[]> {
  try {
    const out = await execAsync(["hyprctl", "clients", "-j"])
    return JSON.parse(out)
  } catch {
    return []
  }
}

function fuzzyScore(query: string, target: string): number {
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

function iconFor(className: string) {
  const c = className.toLowerCase()

  if (c.includes("firefox")) return "firefox"
  if (c.includes("code")) return "visual-studio-code"
  if (c.includes("discord")) return "discord"
  if (c.includes("spotify")) return "spotify"

  return "application-x-executable"
}

export default async function windowsProvider(
  query: string,
): Promise<ProviderResult[]> {
  const clients = await getClients()
  if (!clients.length) return []

  const q = query.trim()

  // ─────────────────────────
  // Empty query → show windows
  // ─────────────────────────
  if (!q) {
    return clients.slice(0, 10).map((win) => ({
      title: win.title || win.class,
      subtitle: `${win.class} • workspace ${win.workspace.id}`,
      icon: iconFor(win.class),
      score: 40,
      action: () =>
        execAsync([
          "hyprctl",
          "dispatch",
          "focuswindow",
          `address:${win.address}`,
        ]).catch(() => {}),
    }))
  }

  // ─────────────────────────
  // Fuzzy search
  // ─────────────────────────
  const results = clients
    .map((win) => {
      const score = Math.max(fuzzyScore(q, win.title), fuzzyScore(q, win.class))

      return { win, score }
    })
    .filter((r) => r.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return results.map((r) => ({
    title: r.win.title || r.win.class,
    subtitle: `${r.win.class} • workspace ${r.win.workspace.id}`,
    icon: iconFor(r.win.class),
    score: r.score + 25,
    action: () =>
      execAsync([
        "hyprctl",
        "dispatch",
        "focuswindow",
        `address:${r.win.address}`,
      ]).catch(() => {}),
  }))
}
