import GLib from "gi://GLib"

const CACHE_PATH = `${GLib.get_user_cache_dir()}/ags_nightlight.json`

export function loadState() {
  try {
    const [success, content] = GLib.file_get_contents(CACHE_PATH)
    return success
      ? JSON.parse(new TextDecoder().decode(content))
      : { auto: false, val: 50, lat: null, lon: null }
  } catch {
    return { auto: false, val: 50, lat: null, lon: null }
  }
}

export function saveState(auto: boolean, val: number, lat?: number, lon?: number) {
  const prev = loadState()
  const data = JSON.stringify({
    auto,
    val,
    lat: lat ?? prev.lat ?? null,
    lon: lon ?? prev.lon ?? null,
  })
  GLib.file_set_contents(CACHE_PATH, data)
}