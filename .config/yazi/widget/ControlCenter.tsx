import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"
import Gio from "gi://Gio"
import Mpris from "gi://AstalMpris"
import {
  wifiOn,
  btOn,
  muted,
  volPct,
  toggleWifi,
  toggleBt,
  toggleMute,
} from "./state"

let bottomStack: Gtk.Stack
let nightSlider: Gtk.Scale | null = null
let nightPill: ReturnType<typeof PillToggle>

// Persistence Helpers
const CACHE_PATH = `${GLib.get_user_cache_dir()}/ags_nightlight.json`

function saveState(auto: boolean, val: number, lat?: number, lon?: number) {
  const prev = loadState()
  const data = JSON.stringify({
    auto,
    val,
    lat: lat ?? prev.lat ?? null,
    lon: lon ?? prev.lon ?? null,
  })
  GLib.file_set_contents(CACHE_PATH, data)
}

function loadState() {
  try {
    const [success, content] = GLib.file_get_contents(CACHE_PATH)
    return success
      ? JSON.parse(new TextDecoder().decode(content))
      : { auto: false, val: 50, lat: null, lon: null }
  } catch {
    return { auto: false, val: 50, lat: null, lon: null }
  }
}

const saved = loadState()
let isNightLightAuto = saved.auto

// ── Night Light core ──────────────────────────────────────────
// still not perfect
const HYPRSUNSET_PID = `${GLib.get_user_runtime_dir()}/hyprsunset-ags.pid`

function launchHyprsunset(
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

// fetch location from IP geolocation
function fetchLocation(): Promise<{ lat: number; lon: number }> {
  return execAsync(["bash", "-c", "curl -sf https://ipinfo.io/json"]).then(
    (raw) => {
      const data = JSON.parse(raw)
      const [lat, lon] = (data.loc ?? "").split(",").map(Number)
      if (!isNaN(lat) && !isNaN(lon)) {
        saveState(isNightLightAuto, saved.val, lat, lon)
        return { lat, lon }
      }
      throw new Error("bad loc")
    },
  )
}

// ── Helpers ───────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// ── Uptime bar ────────────────────────────────────────────────
function UptimeBar() {
  const uptimeLbl = new Gtk.Label()
  uptimeLbl.add_css_class("cc-uptime")
  uptimeLbl.set_halign(Gtk.Align.START)
  uptimeLbl.set_hexpand(true)

  const refresh = () =>
    execAsync(["bash", "-c", "uptime -p | sed 's/up //'"])
      .then((s: string) => uptimeLbl.set_label(s.trim()))
      .catch(() => {})
  refresh()
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
    refresh()
    return GLib.SOURCE_CONTINUE
  })

  const mkPill = (icon: string, label: string, cb: () => void) => {
    const pill = new Gtk.Box()
    pill.set_orientation(Gtk.Orientation.HORIZONTAL)
    pill.set_spacing(4)
    pill.add_css_class("cc-hdr-pill")
    const icn = new Gtk.Label()
    icn.add_css_class("cc-hdr-pill-icon")
    icn.set_label(icon)
    const lbl = new Gtk.Label()
    lbl.add_css_class("cc-hdr-pill-label")
    lbl.set_label(label)
    pill.append(icn)
    pill.append(lbl)
    const click = new Gtk.GestureClick()
    click.connect("pressed", () => cb())
    pill.add_controller(click)
    return pill
  }

  const settingsBtn = mkPill("󰒓", "CONFIG", () =>
    execAsync(["bash", "-c", "foot -e nvim ~/.config/ags/app.ts"]).catch(
      () => {},
    ),
  )

  const reloadBtn = mkPill("󰑓", "RELOAD", () =>
    execAsync([
      "bash",
      "-c",
      "nohup bash -c 'sleep 0.3 && ags run ~/.config/ags/app.ts' &>/dev/null & ags quit",
    ]).catch(() => {}),
  )

  const powerBtn = mkPill("󰐥", "POWER", () =>
    execAsync([
      "bash",
      "-c",
      "wlogout -C ~/.config/wlogout/style.css -b 3 -c 10 -r 10 -m 300",
    ]).catch(() => {}),
  )

  // DND pill — stateful
  const dndPill = new Gtk.Box()
  dndPill.set_orientation(Gtk.Orientation.HORIZONTAL)
  dndPill.set_spacing(4)
  dndPill.add_css_class("cc-hdr-pill")

  const dndIcon = new Gtk.Label()
  dndIcon.add_css_class("cc-hdr-pill-icon")
  dndIcon.set_label("󰂚")
  const dndState = new Gtk.Label()
  dndState.add_css_class("cc-hdr-pill-label")
  dndState.set_label("DND")
  dndPill.append(dndIcon)
  dndPill.append(dndState)

  const refreshDnd = () =>
    execAsync(["swaync-client", "--get-dnd"])
      .then((s: string) => {
        const on = s.trim() === "true"
        dndIcon.set_label(on ? "󰂛" : "󰂚")
        if (on) dndPill.add_css_class("cc-hdr-pill-active")
        else dndPill.remove_css_class("cc-hdr-pill-active")
      })
      .catch(() => {})

  refreshDnd()
  const dndClick = new Gtk.GestureClick()
  dndClick.connect("pressed", () =>
    execAsync(["swaync-client", "--toggle-dnd"])
      .then(refreshDnd)
      .catch(() => {}),
  )
  dndPill.add_controller(dndClick)

  const row = new Gtk.Box()
  row.set_orientation(Gtk.Orientation.HORIZONTAL)
  row.set_spacing(6)
  row.add_css_class("cc-uptime-row")
  row.append(uptimeLbl)
  row.append(settingsBtn)
  row.append(dndPill)
  row.append(reloadBtn)
  row.append(powerBtn)
  return row
}

// ── Slider row ────────────────────────────────────────────────
function SliderRow(
  icon: string,
  iconCls: string,
  getValue: () => number,
  setValue: (v: number) => void,
) {
  const icn = new Gtk.Label()
  icn.add_css_class("cc-slider-icon")
  icn.add_css_class(iconCls)
  icn.set_label(icon)

  const scale = new Gtk.Scale()
  scale.set_orientation(Gtk.Orientation.HORIZONTAL)
  scale.set_range(0, 100)
  scale.set_increments(1, 5)
  scale.set_value(getValue())
  scale.set_hexpand(true)
  scale.set_draw_value(false)
  scale.add_css_class("cc-slider")

  const valLbl = new Gtk.Label()
  valLbl.add_css_class("cc-slider-val")
  valLbl.set_label(`${Math.round(getValue())}`)
  valLbl.set_width_chars(3)
  valLbl.set_xalign(1)

  let suppress = false

  scale.connect("value-changed", () => {
    if (suppress) return
    const v = Math.round(scale.get_value())
    valLbl.set_label(`${v}`)

    if (iconCls === "cc-vol-icon") {
      if (v === 0) icn.set_label("◌")
      else if (v < 30) icn.set_label("◔")
      else if (v < 70) icn.set_label("◑")
      else icn.set_label("◕")
    }

    if (iconCls === "cc-bri-icon") {
      if (v < 30) icn.set_label("☼")
      else if (v < 70) icn.set_label("✺")
      else icn.set_label("✹")
    }

    setValue(v)
  })

  const row = new Gtk.Box()
  row.set_orientation(Gtk.Orientation.HORIZONTAL)
  row.set_spacing(8)
  row.set_valign(Gtk.Align.CENTER)
  row.add_css_class("cc-slider-row")
  row.append(icn)
  row.append(scale)
  row.append(valLbl)

  const setValueSilent = (v: number) => {
    suppress = true
    scale.set_value(v)
    valLbl.set_label(`${v}`)
    suppress = false
  }

  return { row, scale, valLbl, setValueSilent }
}

function Sliders() {
  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(6)
  box.add_css_class("cc-sliders")

  let briScale: Gtk.Scale | null = null
  let briLbl: Gtk.Label | null = null

  // Volume
  const vol = SliderRow(
    "◑",
    "cc-vol-icon",
    () => 50,
    (v) => {
      execAsync(["bash", "-c", `wpctl set-volume @DEFAULT_SINK@ ${v}%`]).catch(
        () => {},
      )
    },
  )
  box.append(vol.row)

  // Brightness
  const bri = SliderRow(
    "✺",
    "cc-bri-icon",
    () => 50,
    (v) => {
      execAsync(["bash", "-c", `brightnessctl set ${v}%`]).catch(() => {})
    },
  )
  briScale = bri.scale
  briLbl = bri.valLbl
  box.append(bri.row)

  // sync from shared poll
  vol.setValueSilent(parseInt(volPct.get().trim()) || 0)
  volPct.subscribe(() => vol.setValueSilent(parseInt(volPct.get().trim()) || 0))

  execAsync([
    "bash",
    "-c",
    "d=$(ls /sys/class/backlight | head -1); echo $(cat /sys/class/backlight/$d/brightness) $(cat /sys/class/backlight/$d/max_brightness)",
  ])
    .then((s: string) => {
      const [cur, max] = s.trim().split(" ").map(Number)
      if (max) {
        const v = Math.round((cur / max) * 100)
        briScale?.set_value(v)
        briLbl?.set_label(`${v}`)
      }
    })
    .catch(() => {})

  return box
}

// ── Pill toggle: [ icon btn | label btn ] ────────────────────
// icon toggles the feature, label opens the related app
function PillToggle({
  icon,
  iconActive,
  label,
  active,
  onToggle,
  onLabelClick,
}: {
  icon: string
  iconActive: string
  label: string
  active: boolean
  onToggle: (v: boolean) => void
  onLabelClick: () => void
}) {
  let on = active

  const pill = new Gtk.Box()
  pill.set_orientation(Gtk.Orientation.HORIZONTAL)
  pill.add_css_class("cc-pill")
  if (on) pill.add_css_class("cc-pill-active")

  // left: icon toggle
  const iconBtn = new Gtk.Box()
  iconBtn.add_css_class("cc-pill-icon-btn")
  const icn = new Gtk.Label()
  icn.add_css_class("cc-pill-icon")
  icn.set_label(on ? iconActive : icon)
  iconBtn.append(icn)
  const iconClick = new Gtk.GestureClick()
  iconClick.connect("pressed", () => {
    on = !on
    icn.set_label(on ? iconActive : icon)
    if (on) pill.add_css_class("cc-pill-active")
    else pill.remove_css_class("cc-pill-active")
    onToggle(on)
  })
  iconBtn.add_controller(iconClick)

  // divider
  const div = new Gtk.Separator()
  div.set_orientation(Gtk.Orientation.VERTICAL)
  div.add_css_class("cc-pill-div")

  // right: label → opens app
  const labelBtn = new Gtk.Box()
  labelBtn.add_css_class("cc-pill-label-btn")
  labelBtn.set_hexpand(true)
  const lbl = new Gtk.Label()
  lbl.add_css_class("cc-pill-label")
  lbl.set_label(label)
  lbl.set_ellipsize(3)
  lbl.set_max_width_chars(12)
  lbl.set_halign(Gtk.Align.START)
  labelBtn.append(lbl)
  const labelClick = new Gtk.GestureClick()
  labelClick.connect("pressed", () => {
    if (onLabelClick) onLabelClick()
  })
  labelBtn.add_controller(labelClick)

  pill.append(iconBtn)
  pill.append(div)
  pill.append(labelBtn)

  return {
    pill,
    lbl,
    icn,
    setActive: (v: boolean) => {
      on = v
      icn.set_label(on ? iconActive : icon)
      if (on) pill.add_css_class("cc-pill-active")
      else pill.remove_css_class("cc-pill-active")
    },
  }
}

function Toggles() {
  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(6)
  box.add_css_class("cc-toggles")

  // ── WiFi ──────────────────────────────────────────────────
  const wifiPill = PillToggle({
    icon: "󰤭",
    iconActive: "󰤨",
    label: "Wi-Fi",
    active: wifiOn.get().trim() === "1",
    onToggle: (v) => toggleWifi(),
    onLabelClick: () =>
      execAsync(["bash", "-c", "kitty nmtui"]).catch(() => {}),
  })
  wifiOn.subscribe(() => wifiPill.setActive(wifiOn.get().trim() === "1"))

  // get connected SSID and update label
  execAsync([
    "bash",
    "-c",
    "nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d: -f2",
  ])
    .then((s: string) => {
      if (s.trim()) wifiPill.lbl.set_label(s.trim())
    })
    .catch(() => {})

  // poll every 5s
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    execAsync([
      "bash",
      "-c",
      "nmcli -t -f active,ssid dev wifi | grep '^yes' | cut -d: -f2",
    ])
      .then((s: string) => wifiPill.lbl.set_label(s.trim() || "Wi-Fi"))
      .catch(() => {})
    return GLib.SOURCE_CONTINUE
  })

  // ── Bluetooth ─────────────────────────────────────────────
  const btPill = PillToggle({
    icon: "󰂲",
    iconActive: "󰂯",
    label: "Bluetooth",
    active: btOn.get().trim() === "1",
    onToggle: (v) => toggleBt(),
    onLabelClick: () =>
      execAsync(["bash", "-c", "kitty bluetui"]).catch(() => {}),
  })
  btOn.subscribe(() => btPill.setActive(btOn.get().trim() === "1"))

  // get connected BT device
  execAsync([
    "bash",
    "-c",
    "bluetoothctl info | grep 'Name:' | head -1 | cut -d' ' -f2-",
  ])
    .then((s: string) => {
      if (s.trim()) btPill.lbl.set_label(s.trim())
    })
    .catch(() => {})

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    execAsync([
      "bash",
      "-c",
      "bluetoothctl info | grep 'Name:' | head -1 | cut -d' ' -f2-",
    ])
      .then((s: string) => btPill.lbl.set_label(s.trim() || "Bluetooth"))
      .catch(() => {})
    return GLib.SOURCE_CONTINUE
  })

  // ── Night Light ───────────────────────────────────────────
  nightPill = PillToggle({
    icon: "󰽤",
    iconActive: "☄",
    label: isNightLightAuto ? "Night (Auto)" : "Night Light",
    active: false,
    onToggle: (v) => {
      if (v) {
        const val = nightSlider ? nightSlider.get_value() : saved.val
        const s = loadState()
        if (isNightLightAuto && s.lat != null && s.lon != null) {
          launchHyprsunset(val, s.lat, s.lon)
        } else {
          launchHyprsunset(val)
        }
      } else {
        isNightLightAuto = false
        saveState(false, nightSlider ? nightSlider.get_value() : saved.val)
        nightPill.lbl.set_label("Night Light")
        execAsync("pkill hyprsunset").catch(() => {})
      }
    },
    onLabelClick: () => bottomStack?.set_visible_child_name("tab-nightlight"),
  })

  // check if hyprsunset is actually running and sync pill
  execAsync(["bash", "-c", "pgrep hyprsunset && echo 1 || echo 0"])
    .then((v) => nightPill.setActive(v.trim() === "1"))
    .catch(() => {})

  // ── Stay Awake ────────────────────────────────────────────
  const awakePill = PillToggle({
    icon: "󰒲",
    iconActive: "󰒳",
    label: "Stay Awake",
    active: false,
    onToggle: (v) =>
      execAsync([
        "bash",
        "-c",
        v
          ? "systemd-inhibit --what=idle sleep infinity &"
          : "pkill -f 'systemd-inhibit'",
      ]).catch(() => {}),
    onLabelClick: () => {},
  })

  const row1 = new Gtk.Box()
  row1.set_orientation(Gtk.Orientation.HORIZONTAL)
  row1.set_spacing(6)
  wifiPill.pill.set_hexpand(true)
  btPill.pill.set_hexpand(true)
  row1.append(wifiPill.pill)
  row1.append(btPill.pill)

  const row2 = new Gtk.Box()
  row2.set_orientation(Gtk.Orientation.HORIZONTAL)
  row2.set_spacing(6)
  nightPill.pill.set_hexpand(true)
  awakePill.pill.set_hexpand(true)
  row2.append(nightPill.pill)
  row2.append(awakePill.pill)

  box.append(row1)
  box.append(row2)

  return box
}

// still has some glitches here and there...mostly the slider
function NightLightSettings() {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
  })
  box.add_css_class("cc-nightlight-cfg")

  let debounceId: number | null = null

  // ── Temperature slider ────────────────────────────────────
  const { row: tempRow, scale: tempScale } = SliderRow(
    "✹",
    "cc-temp-icon",
    () => saved.val,
    (v) => {
      if (debounceId !== null) {
        GLib.source_remove(debounceId)
        debounceId = null
      }
      debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
        saveState(isNightLightAuto, v)
        // always launch without location for immediate preview
        // kicks in properly on next hyprsunset restart at sunset
        launchHyprsunset(v)
        debounceId = null
        return GLib.SOURCE_REMOVE
      })
    },
  )
  nightSlider = tempScale
  tempScale.set_range(0, 100)
  tempScale.set_value(saved.val)

  // ── Location status label ─────────────────────────────────
  const locLbl = new Gtk.Label()
  locLbl.add_css_class("ctrl-pop-detail")
  locLbl.set_halign(Gtk.Align.START)
  const s0 = loadState()
  locLbl.set_label(
    s0.lat != null
      ? `Location: ${s0.lat.toFixed(2)}, ${s0.lon.toFixed(2)}`
      : "Location: not detected",
  )

  // ── Auto toggle ───────────────────────────────────────────
  const autoToggle = new Gtk.CheckButton({
    label: "Auto (sunset → sunrise)",
    active: isNightLightAuto,
  })
  autoToggle.connect("toggled", () => {
    isNightLightAuto = autoToggle.get_active()

    if (isNightLightAuto) {
      const val = tempScale.get_value()
      locLbl.set_label("Detecting location…")
      const existing = loadState()

      const launch = (lat: number, lon: number) => {
        saveState(true, val, lat, lon)
        launchHyprsunset(val, lat, lon)
        locLbl.set_label(`Location: ${lat.toFixed(2)}, ${lon.toFixed(2)}`)
        nightPill.lbl.set_label("Night (Auto)")
        nightPill.pill.add_css_class("cc-pill-auto")
      }

      if (existing.lat != null && existing.lon != null) {
        launch(existing.lat, existing.lon)
      } else {
        fetchLocation()
          .then(({ lat, lon }) => launch(lat, lon))
          .catch(() => {
            locLbl.set_label("Location failed — using always-on")
            saveState(true, val)
            launchHyprsunset(val)
          })
      }
    } else {
      saveState(false, tempScale.get_value())
      nightPill.lbl.set_label("Night Light")
      nightPill.pill.remove_css_class("cc-pill-auto")
      // re-launch without location args (always on at current temp)
      launchHyprsunset(tempScale.get_value())
    }
  })

  // ── Reset location button ─────────────────────────────────
  const refetchBtn = new Gtk.Button({ label: "Re-detect Location" })
  refetchBtn.add_css_class("ctrl-mini-btn")
  refetchBtn.connect("clicked", () => {
    locLbl.set_label("Detecting…")
    fetchLocation()
      .then(({ lat, lon }) => {
        locLbl.set_label(`Location: ${lat.toFixed(2)}, ${lon.toFixed(2)}`)
        if (isNightLightAuto) launchHyprsunset(tempScale.get_value(), lat, lon)
      })
      .catch(() => locLbl.set_label("Detection failed"))
  })

  const backBtn = new Gtk.Button({
    label: "← Back",
    halign: Gtk.Align.START,
    css_classes: ["cc-notif-clear"],
  })
  backBtn.connect("clicked", () => bottomStack?.set_visible_child_name("tab-0"))

  box.append(
    new Gtk.Label({
      label: "Night Light Settings",
      halign: Gtk.Align.START,
      css_classes: ["cc-notif-summary"],
    }),
  )
  box.append(tempRow)
  box.append(autoToggle)
  box.append(locLbl)
  box.append(refetchBtn)
  box.append(new Gtk.Separator())
  box.append(backBtn)

  return box
}

// ── Notification history — accumulated via dbus-monitor ───────
interface NotifEntry {
  app: string
  summary: string
  body: string
  time: number
}
const notifHistory: NotifEntry[] = []
const notifListeners: Array<() => void> = []

// line buffer for dbus-monitor output
let _buf: string[] = []
let _bufTimer = 0
function notifMonitorLine(line: string) {
  _buf.push(line)
  if (_bufTimer) {
    GLib.source_remove(_bufTimer)
    _bufTimer = 0
  }
  _bufTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
    const block = _buf.join("\n")
    _buf = []
    _bufTimer = 0
    const strings: string[] = []
    const re = /string "([^"]*)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(block)) !== null) strings.push(m[1])
    // Notify args: [0]=app_name [1]=app_icon [2]=summary [3]=body
    if (strings.length >= 3) {
      const entry: NotifEntry = {
        app: strings[0] || "Unknown",
        summary: strings[2] || strings[0] || "",
        body: strings[3] || "",
        time: Date.now(),
      }
      if (entry.summary || entry.body) {
        notifHistory.unshift(entry)
        if (notifHistory.length > 50) notifHistory.pop()
        notifListeners.forEach((fn) => fn())
      }
    }
    return GLib.SOURCE_REMOVE
  })
}

;(async () => {
  try {
    const { subprocess } = await import("ags/process")
    subprocess(
      [
        "dbus-monitor",
        "--session",
        "type='method_call',interface='org.freedesktop.Notifications',member='Notify'",
      ],
      (line: string) => notifMonitorLine(line),
    )
  } catch (_) {}
})()

// ── Notifications ─────────────────────────────────────────────
function Notifications() {
  const scroll = new Gtk.ScrolledWindow()
  scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  scroll.set_size_request(-1, 110)
  scroll.add_css_class("cc-notif-scroll")

  const list = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  scroll.set_child(list)

  const render = () => {
    let c = list.get_first_child()
    while (c) {
      list.remove(c)
      c = list.get_first_child()
    }

    if (!notifHistory.length) {
      list.append(
        new Gtk.Label({
          label: "No notifications",
          css_classes: ["cc-notif-empty"],
        }),
      )
      return
    }

    notifHistory.forEach((n, idx) => {
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        css_classes: ["cc-notif-card"],
        spacing: 2,
      })
      const top = new Gtk.Box({ spacing: 4 })
      const icon = new Gtk.Image({
        icon_name: "dialog-information-symbolic",
        pixel_size: 14,
      })
      const summary = new Gtk.Label({
        label: n.summary || n.app,
        css_classes: ["cc-notif-summary"],
        halign: Gtk.Align.START,
        hexpand: true,
        ellipsize: 3,
        max_width_chars: 28,
      })
      const close = new Gtk.Button({
        css_classes: ["cc-notif-close"],
        child: new Gtk.Label({ label: "×" }),
      })
      close.connect("clicked", () => {
        notifHistory.splice(idx, 1)
        render()
      })
      top.append(icon)
      top.append(summary)
      top.append(close)
      row.append(top)
      if (n.body) {
        row.append(
          new Gtk.Label({
            label: n.body,
            css_classes: ["cc-notif-body"],
            halign: Gtk.Align.START,
            ellipsize: 3,
            max_width_chars: 28,
          }),
        )
      }
      list.append(row)
    })
  }

  notifListeners.push(render)
  notifRefresh = render
  render()

  const clear = new Gtk.Button({
    label: "Clear",
    css_classes: ["cc-notif-clear"],
    halign: Gtk.Align.END,
  })
  clear.connect("clicked", () => {
    notifHistory.length = 0
    render()
  })

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
  box.append(scroll)
  box.append(clear)
  return box
}
function AudioPlayer() {
  const mpris = Mpris.get_default()

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["cc-audio-container"],
    spacing: 6,
  })

  const getActivePlayer = () =>
    mpris.players.find(
      (p) => p.playback_status === Mpris.PlaybackStatus.PLAYING,
    ) || mpris.players[0]

  const clear = () => {
    let c = container.get_first_child()
    while (c) {
      container.remove(c)
      c = container.get_first_child()
    }
  }

  const update = () => {
    clear()

    const player = getActivePlayer()
    if (!player) {
      container.append(
        new Gtk.Label({
          label: "Idle",
          css_classes: ["cc-audio-artist"],
        }),
      )
      return
    }

    // ── Row ─────────────────────────────
    const row = new Gtk.Box({ spacing: 8 })

    const art = new Gtk.Image({
      pixel_size: 36,
      css_classes: ["cc-audio-art"],
    })

    if (player.art_url) {
      try {
        art.set_from_file(player.art_url.replace("file://", ""))
      } catch {}
    }

    const meta = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      hexpand: true,
      spacing: 0,
    })

    const title = new Gtk.Label({
      label: player.title || "Unknown",
      css_classes: ["cc-audio-title"],
      halign: Gtk.Align.START,
      ellipsize: 3,
      max_width_chars: 22,
    })

    const artist = new Gtk.Label({
      label: player.artist || "",
      css_classes: ["cc-audio-artist"],
      halign: Gtk.Align.START,
      ellipsize: 3,
      max_width_chars: 22,
    })

    player.connect("notify::title", () =>
      title.set_label(player.title || "Unknown"),
    )
    player.connect("notify::artist", () =>
      artist.set_label(player.artist || ""),
    )

    meta.append(title)
    meta.append(artist)

    const playBtn = new Gtk.Button({
      css_classes: ["cc-audio-play-btn"],
    })

    const icon = new Gtk.Image()

    const syncIcon = () => {
      icon.icon_name =
        player.playback_status === Mpris.PlaybackStatus.PLAYING
          ? "media-playback-pause-symbolic"
          : "media-playback-start-symbolic"
    }

    syncIcon()
    player.connect("notify::playback-status", syncIcon)

    playBtn.set_child(icon)
    playBtn.connect("clicked", () => player.play_pause())

    row.append(art)
    row.append(meta)
    row.append(playBtn)

    container.append(row)

    // ── Thin progress ───────────────────
    const progress = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      draw_value: false,
      height_request: 4,
    })

    progress.set_range(0, player.length || 1)

    player.connect("notify::position", () =>
      progress.set_value(player.position || 0),
    )

    container.append(progress)
  }

  mpris.connect("notify::players", update)
  update()

  return container
}

// ── Calendar ──────────────────────────────────────────────────
function Calendar() {
  const cal = new Gtk.Calendar()
  cal.add_css_class("cc-calendar")
  return cal
}

// ── Todo ──────────────────────────────────────────────────────
function Todo() {
  const TODO_FILE = `${GLib.get_home_dir()}/.config/ags/todos.json`

  interface Task {
    text: string
    done: boolean
  }

  function loadTodos(): Task[] {
    try {
      const file = Gio.File.new_for_path(TODO_FILE)
      const [success, contents] = file.load_contents(null)
      const raw = JSON.parse(new TextDecoder().decode(contents))
      // Map old strings to new objects to prevent 'undefined' crashes
      return raw.map((t: any) =>
        typeof t === "string" ? { text: t, done: false } : t,
      )
    } catch {
      return []
    }
  }

  function saveTodos(data: Task[]) {
    const file = Gio.File.new_for_path(TODO_FILE)
    const bytes = new TextEncoder().encode(JSON.stringify(data))
    file.replace_contents_async(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
      null,
    )
  }

  let tasks = loadTodos()
  const list = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  list.add_css_class("cc-todo-list")

  const render = () => {
    let child = list.get_first_child()
    while (child) {
      list.remove(child)
      child = list.get_first_child()
    }

    tasks.forEach((task, idx) => {
      const isDone = !!task.done // Force boolean to satisfy Gtk
      const row = new Gtk.Box({ spacing: 6 })
      row.add_css_class("cc-todo-row")
      if (isDone) row.add_css_class("cc-todo-done")

      const check = new Gtk.CheckButton({ active: isDone })
      check.connect("toggled", () => {
        tasks[idx].done = check.get_active()
        saveTodos(tasks)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
          render()
          return false
        })
      })

      const lbl = new Gtk.Label({
        label: task.text || "Unnamed Task",
        hexpand: true,
        halign: Gtk.Align.START,
        ellipsize: 3,
      })
      lbl.add_css_class("cc-todo-lbl")

      const del = new Gtk.Button({
        child: new Gtk.Label({ label: "×" }),
        css_classes: ["cc-todo-del"],
      })
      del.connect("clicked", () => {
        tasks.splice(idx, 1)
        saveTodos(tasks)
        render()
      })

      row.append(check)
      row.append(lbl)
      row.append(del)
      list.append(row)
    })
  }

  const entry = new Gtk.Entry({
    placeholder_text: "Add task...",
    hexpand: true,
  })
  entry.add_css_class("cc-todo-entry")
  entry.connect("activate", () => {
    const val = entry.get_text().trim()
    if (!val) return
    tasks.push({ text: val, done: false })
    saveTodos(tasks)
    entry.set_text("")
    render()
  })

  const clearBtn = new Gtk.Button({
    label: "Clear Completed",
    css_classes: ["cc-todo-clear"],
    hexpand: true,
  })
  clearBtn.connect("clicked", () => {
    tasks = tasks.filter((t) => !t.done)
    saveTodos(tasks)
    render()
  })

  const scroll = new Gtk.ScrolledWindow({ vexpand: true, child: list })
  scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  box.append(scroll)
  box.append(entry)
  box.append(clearBtn)

  render()
  return box
}

// ── Timer ─────────────────────────────────────────────────────
function Timer() {
  let seconds = 0
  let running = false
  let countdownFrom = 0
  let timerId = 0
  let isCountdown = false

  const display = new Gtk.Label()
  display.add_css_class("cc-timer-display")
  display.set_label("00:00")

  const fmt = (s: number) => {
    const m = Math.floor(Math.abs(s) / 60)
      .toString()
      .padStart(2, "0")
    const sec = (Math.abs(s) % 60).toString().padStart(2, "0")
    return `${m}:${sec}`
  }

  const tick = () => {
    if (isCountdown) {
      seconds--
      if (seconds <= 0) {
        seconds = 0
        running = false
        if (timerId) {
          GLib.source_remove(timerId)
          timerId = 0
        }
      }
    } else {
      seconds++
    }
    display.set_label(fmt(seconds))
    return running ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE
  }

  const startBtn = new Gtk.Button()
  startBtn.add_css_class("cc-timer-btn")
  const startLbl = new Gtk.Label()
  startLbl.set_label("▶")
  startBtn.set_child(startLbl)

  const resetBtn = new Gtk.Button()
  resetBtn.add_css_class("cc-timer-btn")
  const resetLbl = new Gtk.Label()
  resetLbl.set_label("↺")
  resetBtn.set_child(resetLbl)

  // countdown input
  const minuteEntry = new Gtk.Entry()
  minuteEntry.add_css_class("cc-timer-entry")
  minuteEntry.set_placeholder_text("min")
  minuteEntry.set_width_chars(4)
  minuteEntry.set_max_width_chars(4)

  startBtn.connect("clicked", () => {
    if (running) {
      running = false
      if (timerId) {
        GLib.source_remove(timerId)
        timerId = 0
      }
      startLbl.set_label("▶")
      return
    }
    const mins = parseInt(minuteEntry.get_text())
    if (!isNaN(mins) && mins > 0) {
      isCountdown = true
      seconds = mins * 60
      countdownFrom = seconds
    } else {
      isCountdown = false
    }
    running = true
    startLbl.set_label("⏸")
    timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, tick)
  })

  resetBtn.connect("clicked", () => {
    running = false
    if (timerId) {
      GLib.source_remove(timerId)
      timerId = 0
    }
    seconds = 0
    isCountdown = false
    display.set_label("00:00")
    startLbl.set_label("▶")
    minuteEntry.set_text("")
  })

  const controls = new Gtk.Box()
  controls.set_orientation(Gtk.Orientation.HORIZONTAL)
  controls.set_spacing(8)
  controls.set_halign(Gtk.Align.CENTER)
  controls.append(minuteEntry)
  controls.append(startBtn)
  controls.append(resetBtn)

  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(10)
  box.set_halign(Gtk.Align.CENTER)
  box.add_css_class("cc-timer")
  box.append(display)
  box.append(controls)
  return box
}

// ── Bottom tabs: Calendar / Todo / Timer ──────────────────────
function BottomTabs() {
  const tabs = ["☷ Calendar", "☑ To Do", "⏱ Timer"]
  const contents = [Calendar(), Todo(), Timer(), NightLightSettings()]
  let active = 0

  const tabBar = new Gtk.Box()
  tabBar.set_orientation(Gtk.Orientation.HORIZONTAL)
  tabBar.set_spacing(0)
  tabBar.add_css_class("cc-tab-bar")

  const stack = new Gtk.Stack()
  stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  stack.set_transition_duration(150)
  stack.set_vexpand(true)

  contents.forEach((w, i) => {
    const name = i === 3 ? "tab-nightlight" : `tab-${i}`
    stack.add_named(w, name)
  })

  // Export stack to global/outer scope for the Night Light Pill to use
  bottomStack = stack

  const btns = tabs.map((t, i) => {
    const btn = new Gtk.Button()
    btn.add_css_class("cc-tab-btn")
    if (i === 0) btn.add_css_class("cc-tab-active")

    const lbl = new Gtk.Label()
    lbl.set_label(t)
    btn.set_child(lbl)

    btn.connect("clicked", () => {
      btns[active]?.remove_css_class("cc-tab-active")
      active = i
      btn.add_css_class("cc-tab-active")
      stack.set_visible_child_name(`tab-${i}`)
    })

    tabBar.append(btn)
    return btn
  })

  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(0)
  box.set_vexpand(true)
  box.append(tabBar)
  box.append(stack)

  return box
}

// ── Top tabs: Audio / Notifications ──────────────────────────
function TopTabs() {
  const tabs = ["Audio", "Notifications"]
  const contents = [AudioPlayer(), Notifications()]
  let active = 0

  const tabBar = new Gtk.Box()
  tabBar.set_orientation(Gtk.Orientation.HORIZONTAL)
  tabBar.set_spacing(0)
  tabBar.add_css_class("cc-tab-bar")

  const stack = new Gtk.Stack()
  stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  stack.set_transition_duration(150)

  // Use a unique name prefix to avoid conflict with bottom stack
  contents.forEach((w, i) => stack.add_named(w, `top-tab-${i}`))
  stack.set_visible_child_name("top-tab-0")

  const btns = tabs.map((t, i) => {
    const btn = new Gtk.Button()
    btn.add_css_class("cc-tab-btn")
    if (i === 0) btn.add_css_class("cc-tab-active")

    const lbl = new Gtk.Label()
    lbl.set_label(t)
    btn.set_child(lbl)

    btn.connect("clicked", () => {
      btns[active].remove_css_class("cc-tab-active")
      active = i
      btn.add_css_class("cc-tab-active")
      stack.set_visible_child_name(`top-tab-${i}`)
    })

    tabBar.append(btn)
    return btn
  })

  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(0)
  box.append(tabBar)
  box.append(stack)

  return box
}

// ── Separator ─────────────────────────────────────────────────
function Sep() {
  const s = new Gtk.Separator()
  s.set_orientation(Gtk.Orientation.HORIZONTAL)
  s.add_css_class("cc-sep")
  return s
}

// ── Main panel ────────────────────────────────────────────────
let panelRef: any = null
let notifRefresh: (() => void) | null = null

export function closePanel() {
  panelRef?.set_visible(false)
}

export function togglePanel() {
  if (!panelRef) return
  panelRef.set_visible(!panelRef.get_visible())
}

export default function ControlCenter() {
  const panel = new Gtk.Box()
  panel.set_orientation(Gtk.Orientation.VERTICAL)
  panel.set_spacing(8)
  panel.add_css_class("cc-panel")

  panel.append(UptimeBar())
  panel.append(Sep())
  panel.append(Sliders())
  panel.append(Sep())
  panel.append(Toggles())
  panel.append(Sep())
  panel.append(TopTabs())
  panel.append(Sep())
  panel.append(BottomTabs())

  // full-screen window — panel sits right-aligned inside
  // clicks on transparent left area close the panel
  const overlay = new Gtk.Overlay()

  const backdrop = new Gtk.Box()
  backdrop.set_hexpand(true)
  backdrop.set_vexpand(true)
  overlay.set_child(backdrop)

  // panel aligned to right
  panel.set_halign(Gtk.Align.END)
  panel.set_valign(Gtk.Align.FILL)
  panel.set_margin_top(8)
  panel.set_margin_bottom(8)
  panel.set_margin_end(8)
  overlay.add_overlay(panel)

  const win = (
    <window
      cssClasses={["cc-window"]}
      visible={false}
      layer={Astal.Layer.OVERLAY}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.RIGHT |
        Astal.WindowAnchor.BOTTOM |
        Astal.WindowAnchor.LEFT
      }
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.EXCLUSIVE}
      application={app}
    >
      {overlay}
    </window>
  )

  panelRef = win

  // click on backdrop (outside panel) → close
  const backdropClick = new Gtk.GestureClick()
  backdropClick.connect("pressed", closePanel)
  backdrop.add_controller(backdropClick)

  // ESC to close
  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_w: any, keyval: number) => {
    if (keyval === 65307) closePanel()
    return false
  })
  win.add_controller(key)

  return win
}
