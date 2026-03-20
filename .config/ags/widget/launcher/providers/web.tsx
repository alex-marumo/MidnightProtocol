import type { ProviderResult } from "../launcher"
import { getRanking } from "../ranking"
import { execAsync } from "ags/process"

interface WebEntry {
  title: string
  url: string
}

const webHistory: WebEntry[] = [
  { title: "GitHub", url: "https://github.com" },
  { title: "Stack Overflow", url: "https://stackoverflow.com" },
  { title: "MDN Web Docs", url: "https://developer.mozilla.org" },
  { title: "Reddit", url: "https://reddit.com" },
]

function looksLikeUrl(q: string) {
  return /^(https?:\/\/)?[a-z0-9\-]+\.[a-z]{2,}/i.test(q)
}

export default function webProvider(query: string): ProviderResult[] {
  const q = query.trim().toLowerCase()
  const results: ProviderResult[] = []

  // ─────────────────────────
  // Empty query → show bookmarks
  // ─────────────────────────
  if (!q) {
    return webHistory.slice(0, 4).map((entry) => ({
      title: entry.title,
      subtitle: entry.url,
      icon: "web-browser-symbolic",
      score: getRanking(entry.url) || 5,
      action: () => openURL(entry.url),
    }))
  }

  // ─────────────────────────
  // Match bookmarks/history
  // ─────────────────────────
  for (const entry of webHistory) {
    if (
      entry.title.toLowerCase().includes(q) ||
      entry.url.toLowerCase().includes(q)
    ) {
      results.push({
        title: entry.title,
        subtitle: entry.url,
        icon: "web-browser-symbolic",
        score: 100 + (getRanking(entry.url) || 0),
        action: () => openURL(entry.url),
      })
    }
  }

  // ─────────────────────────
  // Direct URL open
  // ─────────────────────────
  if (looksLikeUrl(q)) {
    const url = q.startsWith("http") ? q : `https://${q}`

    results.push({
      title: "Open URL",
      subtitle: url,
      icon: "network-workgroup-symbolic",
      score: 200,
      action: () => openURL(url),
    })
  }

  // ─────────────────────────
  // Search fallback
  // ─────────────────────────
  if (q.length > 2) {
    results.push({
      title: `Search "${query}"`,
      subtitle: "DuckDuckGo",
      icon: "system-search-symbolic",
      score: 50,
      action: () =>
        openURL(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`),
    })
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 5)
}

function openURL(url: string) {
  execAsync(["xdg-open", url]).catch(() => {})
}
