import appsProvider from "./providers/apps"
import runProvider from "./providers/run"
import calcProvider from "./providers/calc"
import webProvider from "./providers/web"
import windowsProvider from "./providers/windows"
import filesProvider from "./providers/files"
import historyProvider, { recordHistory } from "./providers/history"
import { bumpRanking } from "./ranking"

export type ProviderResult = {
  title: string
  subtitle?: string
  icon?: string
  action: () => void
  score?: number
}

const providers = [
  historyProvider,
  appsProvider,
  runProvider,
  windowsProvider,
  webProvider,
  filesProvider,
]

let queryToken = 0

export async function queryLauncher(query: string): Promise<ProviderResult[]> {
  const token = ++queryToken
  const q = query.trim()
  if (!q) return await historyProvider("")

  let results: ProviderResult[] = []

  // ── 1. MATH CHECK (Soft Intercept) ────────────────────────
  // add math results to the list but don't stop the function
  if (/[0-9]/.test(q) && /[+\-*/%^]/.test(q)) {
    const calcResults = await calcProvider(q)
    if (calcResults.length > 0) {
      results.push(...calcResults)
    }
  }

  // ── 2. STANDARD SEARCH ────────────────────────────────────
  const providerResults = await Promise.all(
    providers.map(async (p) => {
      try {
        let res = p(query)
        if (res instanceof Promise) res = await res
        return (res as ProviderResult[]).map((item) => ({
          ...item,
          icon: item.icon || getFallbackIcon(item),
        }))
      } catch {
        return []
      }
    }),
  )

  if (token !== queryToken) return []

  // Combine math with apps, files, etc.
  results = [...results, ...providerResults.flat()]

  // ── 3. SMART SORTING ──────────────────────────────────────
  results.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0)
    if (scoreDiff !== 0) return scoreDiff
    return a.title.localeCompare(b.title)
  })

  return results
}

export function execute(entry: ProviderResult) {
  entry.action()
  recordHistory(entry)
  const key = entry.subtitle || entry.title
  if (key) bumpRanking(key)
}

function getFallbackIcon(item: ProviderResult): string {
  if (item.subtitle?.startsWith("http")) return "web-browser-symbolic"
  if (item.subtitle?.startsWith("/")) return "folder-symbolic"
  return "system-run-symbolic"
}

