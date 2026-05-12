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
  executable?: string
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

export async function queryLauncher(query: string, tab: string = "history"): Promise<ProviderResult[]> {
  const q = query.trim()

  try {
    switch (tab) {
      case "history":
        return historyProvider(q)
      case "apps":
        const apps = appsProvider(q)
        console.log(`[apps] query="${q}" returned ${apps.length} results`)
        return apps
      case "run":
        return runProvider(q)
      case "files":
        return filesProvider(q)
      case "web":
        return webProvider(q)
      case "windows":
        return windowsProvider(q)
      case "calc":
        return await calcProvider(q)
      default:
        return historyProvider(q)
    }
  } catch (err) {
    console.error("Provider error:", err)
    return []
  }
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