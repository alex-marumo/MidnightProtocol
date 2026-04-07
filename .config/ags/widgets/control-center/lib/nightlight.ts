import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import { saveState, loadState } from "./persistence"
import { Gtk } from "ags/gtk4"

const HYPRSUNSET_PID = `${GLib.get_user_runtime_dir()}/hyprsunset-ags.pid`

export function launchHyprsunset(
  val: number,
  lat?: number | null,
  lon?: number | null,
) {
  const k = Math.floor(6500 - val * 55)
  const locArgs =
    lat != null && lon != null ? `--latitude ${lat} --longitude ${lon}` : ""
  execAsync(`bash -c "
    OLD=$(cat ${HYPRSUNSET_PID} 2>/dev/null);
    nohup hyprsunset --temperature ${k} ${locArgs} >/dev/null 2>&1 &
    echo $! > ${HYPRSUNSET_PID};
    sleep 0.05;
    [ -n \\"$OLD\\" ] && kill $OLD 2>/dev/null || true
  "`).catch(() => {})
}

export function fetchLocation(): Promise<{ lat: number; lon: number }> {
  return execAsync(["bash", "-c", "curl -sf https://ipinfo.io/json"]).then(
    (raw) => {
      const data = JSON.parse(raw)
      const [lat, lon] = (data.loc ?? "").split(",").map(Number)
      if (!isNaN(lat) && !isNaN(lon)) {
        saveState(loadState().auto, loadState().val, lat, lon)  // preserve auto
        return { lat, lon }
      }
      throw new Error("bad loc")
    },
  )
}

// shared refs
export const nightRefs = {
  isNightLightAuto: loadState().auto,
  nightSlider: null as Gtk.Scale | null,
  nightPill: null as any,
  bottomStack: null as Gtk.Stack | null,
}