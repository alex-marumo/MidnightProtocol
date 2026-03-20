import { execAsync } from "ags/process"
import type { ProviderResult } from "../launcher"
import { getRanking } from "../ranking"
import GLib from "gi://GLib"

const homeDir = GLib.get_home_dir()

function looksLikeFileQuery(q: string) {
  return (
    q.startsWith("/") ||
    q.startsWith("./") ||
    q.startsWith("~/") ||
    q.includes(".")
  )
}

async function findFiles(term: string): Promise<string[]> {
  if (term.length < 2) return []

  try {
    const out = await execAsync([
      "fd",
      "--type",
      "f",
      "--hidden",
      "--exclude",
      ".git",
      "--max-results",
      "20",
      "--ignore-case",
      term,
      homeDir,
    ])

    return out.trim().split("\n").filter(Boolean)
  } catch {
    return []
  }
}

function iconFor(path: string) {
  if (path.endsWith(".png") || path.endsWith(".jpg") || path.endsWith(".webp"))
    return "image-x-generic"

  if (path.endsWith(".mp4") || path.endsWith(".mkv")) return "video-x-generic"

  if (path.endsWith(".mp3") || path.endsWith(".flac")) return "audio-x-generic"

  if (path.endsWith(".pdf")) return "application-pdf"

  if (path.endsWith(".zip") || path.endsWith(".tar")) return "package-x-generic"

  return "text-x-generic"
}

export default async function filesProvider(
  query: string,
): Promise<ProviderResult[]> {
  const q = query.trim()

  if (!looksLikeFileQuery(q)) return []

  const term = q.replace(/^\/|^~\//, "")
  if (!term) return []

  const paths = await findFiles(term)

  return paths.slice(0, 15).map((path) => {
    const name = path.split("/").pop() || path

    return {
      title: name,
      subtitle: path,
      icon: iconFor(path),
      score: 50 + (getRanking(path) || 0),
      action: () => execAsync(["xdg-open", path]).catch(() => {}),
    }
  })
}
