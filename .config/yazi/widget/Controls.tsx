import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import {
  wifiOn,
  btOn,
  muted,
  volPct,
  keyboard,
  wifiSsid,
  btDevice,
  toggleWifi,
  toggleBt,
  toggleMute,
} from "./state"

// ── Network scanner ───────────────────────────────────────────
interface Network {
  ssid: string
  signal: number
  security: string
  active: boolean
}

function signalBars(sig: number): string {
  if (sig >= 80) return "▂▄▆█"
  if (sig >= 60) return "▂▄▆░"
  if (sig >= 40) return "▂▄░░"
  if (sig >= 20) return "▂░░░"
  return "░░░░"
}

async function scanNetworks(): Promise<Network[]> {
  const raw = await execAsync([
    "bash",
    "-c",
    "nmcli -t -f SSID,SIGNAL,SECURITY,ACTIVE dev wifi list 2>/dev/null",
  ])
  const seen = new Set<string>()
  return raw
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      const parts = l.split(":")
      return {
        ssid: parts[0] || "",
        signal: parseInt(parts[1]) || 0,
        security: parts[2] || "",
        active: parts[3]?.trim() === "yes",
      }
    })
    .filter((n) => {
      if (!n.ssid || seen.has(n.ssid)) return false
      seen.add(n.ssid)
      return true
    })
    .sort((a, b) => b.signal - a.signal)
}

async function rescan() {
  await execAsync(["nmcli", "dev", "wifi", "rescan"]).catch(() => {})
}

async function disconnect() {
  await execAsync([
    "bash",
    "-c",
    "nmcli dev disconnect $(nmcli -t -f DEVICE,TYPE dev | grep ':wifi' | cut -d: -f1 | head -1)",
  ]).catch(() => {})
}

export default function Controls() {
  // ── popover ────────────────────────────────────────────────
  const popover = new Gtk.Popover()
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.RIGHT)
  popover.add_css_class("ctrl-popover")
  popover.set_autohide(false)

  const mainBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
  })
  mainBox.add_css_class("ctrl-pop-card")

  // ── TOP ROW: Audio + Bluetooth ────────────────────────────
  const topRow = new Gtk.Box({ spacing: 8 })

  // ── Audio panel ───────────────────────────────────────────
  const audioBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
  })
  audioBox.add_css_class("ctrl-panel")
  audioBox.set_hexpand(true)

  const audioHeader = new Gtk.Label({ label: "AUDIO" })
  audioHeader.add_css_class("ctrl-panel-header")
  audioHeader.set_halign(Gtk.Align.START)
  audioBox.append(audioHeader)

  // mute toggle row
  const muteRow = new Gtk.Box({ spacing: 6 })
  muteRow.set_valign(Gtk.Align.CENTER)
  const muteIcn = new Gtk.Label()
  muteIcn.add_css_class("ctrl-pop-icon")
  muteIcn.set_label("󰕾")
  const muteLbl = new Gtk.Label({ label: "Unmuted" })
  muteLbl.add_css_class("ctrl-pop-state")
  muteLbl.set_hexpand(true)
  muteLbl.set_halign(Gtk.Align.START)
  const muteBtn = new Gtk.Button()
  muteBtn.add_css_class("ctrl-mini-btn")
  const muteBtnLbl = new Gtk.Label({ label: "Mute" })
  muteBtn.set_child(muteBtnLbl)
  muteBtn.connect("clicked", () => {
    const isMuted = muted.get().trim() === "1"
    syncMute(isMuted ? "0" : "1")
    toggleMute()
  })
  const syncMute = (m: string) => {
    const on = m.trim() === "1"
    muteIcn.set_label(on ? "󰝟" : "󰕾")
    muteLbl.set_label(on ? "Muted" : "Unmuted")
    muteBtnLbl.set_label(on ? "Unmute" : "Mute")
  }
  syncMute(muted.get())
  muted.subscribe(() => syncMute(muted.get()))
  muteRow.append(muteIcn)
  muteRow.append(muteLbl)
  muteRow.append(muteBtn)
  audioBox.append(muteRow)

  // volume bar
  const volRow = new Gtk.Box({
    spacing: 6,
    orientation: Gtk.Orientation.VERTICAL,
  })
  const volTop = new Gtk.Box({ spacing: 0 })
  const volLbl = new Gtk.Label({ label: "Volume" })
  volLbl.add_css_class("ctrl-pop-detail")
  volLbl.set_hexpand(true)
  volLbl.set_halign(Gtk.Align.START)
  const volNum = new Gtk.Label()
  volNum.add_css_class("ctrl-pop-detail")
  volTop.append(volLbl)
  volTop.append(volNum)
  const track = new Gtk.Box()
  track.add_css_class("ctrl-pop-vol-track")
  track.set_size_request(80, 4)
  const fill = new Gtk.Box()
  fill.add_css_class("ctrl-pop-vol-fill")
  track.append(fill)
  const syncVol = (p: string) => {
    const v = parseInt(p.trim()) || 0
    volNum.set_label(v + "%")
    fill.set_size_request(Math.round(v * 0.8), 4)
  }
  syncVol(volPct.get())
  volPct.subscribe(() => syncVol(volPct.get()))
  volRow.append(volTop)
  volRow.append(track)
  audioBox.append(volRow)

  // easyeffects
  const fxBtn = new Gtk.Button({ label: "EasyEffects" })
  fxBtn.add_css_class("ctrl-mini-btn")
  fxBtn.connect("clicked", () => execAsync(["easyeffects"]).catch(() => {}))
  audioBox.append(fxBtn)

  topRow.append(audioBox)

  // ── Bluetooth panel ────────────────────────────────────────
  const btBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
  })
  btBox.add_css_class("ctrl-panel")
  btBox.set_hexpand(true)

  const btHeader = new Gtk.Label({ label: "BLUETOOTH" })
  btHeader.add_css_class("ctrl-panel-header")
  btHeader.set_halign(Gtk.Align.START)
  btBox.append(btHeader)

  const btStatusRow = new Gtk.Box({ spacing: 6 })
  const btIcn = new Gtk.Label()
  btIcn.add_css_class("ctrl-pop-icon")
  const btStateLbl = new Gtk.Label()
  btStateLbl.add_css_class("ctrl-pop-state")
  btStateLbl.set_hexpand(true)
  btStateLbl.set_halign(Gtk.Align.START)
  const btToggleBtn = new Gtk.Button()
  btToggleBtn.add_css_class("ctrl-mini-btn")
  const btToggleLbl = new Gtk.Label()
  btToggleBtn.set_child(btToggleLbl)

  const syncBt = (v: string) => {
    const on = v.trim() === "1"
    btIcn.set_label(on ? "󰂯" : "󰂲")
    btStateLbl.set_label(on ? "On" : "Off")
    btToggleLbl.set_label(on ? "Disable" : "Enable")
  }

  btToggleBtn.connect("clicked", () => {
    const isOn = btOn.get().trim() === "1"
    syncBt(isOn ? "0" : "1")
    toggleBt()
  })
  syncBt(btOn.get())
  btOn.subscribe(() => syncBt(btOn.get()))
  btStatusRow.append(btIcn)
  btStatusRow.append(btStateLbl)
  btStatusRow.append(btToggleBtn)
  btBox.append(btStatusRow)

  const btDeviceLbl = new Gtk.Label({ label: "No device" })
  btDeviceLbl.add_css_class("ctrl-pop-detail")
  btDeviceLbl.set_halign(Gtk.Align.START)
  btDeviceLbl.set_ellipsize(3)
  btDeviceLbl.set_max_width_chars(12)
  btBox.append(btDeviceLbl)

  const btToolBtn = new Gtk.Button({ label: "bluetui" })
  btToolBtn.add_css_class("ctrl-mini-btn")
  btToolBtn.connect("clicked", () =>
    execAsync(["foot", "-e", "bluetui"]).catch(() => {}),
  )
  btBox.append(btToolBtn)

  topRow.append(btBox)
  mainBox.append(topRow)

  // ── Separator ──────────────────────────────────────────────
  const sep = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL })
  mainBox.append(sep)

  // ── WiFi panel ─────────────────────────────────────────────
  const wifiBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
  })
  wifiBox.add_css_class("ctrl-panel")

  // wifi header row
  const wifiHeaderRow = new Gtk.Box({ spacing: 6 })
  const wifiHeader = new Gtk.Label({ label: "WI-FI" })
  wifiHeader.add_css_class("ctrl-panel-header")
  wifiHeader.set_hexpand(true)
  wifiHeader.set_halign(Gtk.Align.START)
  const wifiToggleBtn = new Gtk.Button()
  wifiToggleBtn.add_css_class("ctrl-mini-btn")
  const wifiToggleLbl = new Gtk.Label()
  wifiToggleBtn.set_child(wifiToggleLbl)
  const syncWifiToggle = (v: string) =>
    wifiToggleLbl.set_label(v.trim() === "1" ? "Disable" : "Enable")

  wifiToggleBtn.connect("clicked", () => {
    const isOn = wifiOn.get().trim() === "1"
    syncWifiToggle(isOn ? "0" : "1")
    toggleWifi()
  })
  syncWifiToggle(wifiOn.get())
  wifiOn.subscribe(() => syncWifiToggle(wifiOn.get()))

  const scanBtn = new Gtk.Button({ label: "⟳ Scan" })
  scanBtn.add_css_class("ctrl-mini-btn")

  wifiHeaderRow.append(wifiHeader)
  wifiHeaderRow.append(wifiToggleBtn)
  wifiHeaderRow.append(scanBtn)
  wifiBox.append(wifiHeaderRow)

  // network list
  const netScroll = new Gtk.ScrolledWindow()
  netScroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  netScroll.set_size_request(-1, 140)

  const netList = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
  })
  netList.add_css_class("ctrl-net-list")
  netScroll.set_child(netList)
  wifiBox.append(netScroll)

  // password entry (hidden until needed)
  const pwdBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  pwdBox.set_visible(false)
  const pwdLbl = new Gtk.Label({ label: "Password" })
  pwdLbl.add_css_class("ctrl-pop-detail")
  pwdLbl.set_halign(Gtk.Align.START)
  const pwdEntry = new Gtk.Entry()
  pwdEntry.set_visibility(false)
  pwdEntry.set_placeholder_text("Enter password…")
  pwdEntry.add_css_class("ctrl-pwd-entry")
  const pwdBtnRow = new Gtk.Box({ spacing: 6, halign: Gtk.Align.END })
  const pwdCancel = new Gtk.Button({ label: "Cancel" })
  pwdCancel.add_css_class("ctrl-mini-btn")
  const pwdConnect = new Gtk.Button({ label: "Connect" })
  pwdConnect.add_css_class("ctrl-mini-btn-accent")
  pwdBtnRow.append(pwdCancel)
  pwdBtnRow.append(pwdConnect)
  pwdBox.append(pwdLbl)
  pwdBox.append(pwdEntry)
  pwdBox.append(pwdBtnRow)
  wifiBox.append(pwdBox)

  let pendingSsid = ""
  let scanning = false

  const statusLbl = new Gtk.Label({ label: "" })
  statusLbl.add_css_class("ctrl-pop-detail")
  statusLbl.set_halign(Gtk.Align.START)
  wifiBox.append(statusLbl)

  const renderNetworks = (networks: Network[]) => {
    let c = netList.get_first_child()
    while (c) {
      netList.remove(c)
      c = netList.get_first_child()
    }

    if (!networks.length) {
      const empty = new Gtk.Label({ label: "No networks found" })
      empty.add_css_class("ctrl-pop-detail")
      netList.append(empty)
      return
    }

    networks.forEach((n) => {
      const row = new Gtk.Box({ spacing: 6 })
      row.add_css_class(n.active ? "ctrl-net-row-active" : "ctrl-net-row")

      const ssidLbl = new Gtk.Label({ label: n.ssid })
      ssidLbl.add_css_class(n.active ? "ctrl-net-ssid-active" : "ctrl-net-ssid")
      ssidLbl.set_hexpand(true)
      ssidLbl.set_halign(Gtk.Align.START)
      ssidLbl.set_ellipsize(3)
      ssidLbl.set_max_width_chars(16)

      const bars = new Gtk.Label({ label: signalBars(n.signal) })
      bars.add_css_class("ctrl-net-bars")

      const lock = new Gtk.Label({ label: n.security ? "󰌆" : "" })
      lock.add_css_class("ctrl-net-lock")

      const connBtn = new Gtk.Button({ label: n.active ? "✓" : "→" })
      connBtn.add_css_class(n.active ? "ctrl-net-btn-active" : "ctrl-net-btn")
      connBtn.connect("clicked", () => {
        if (n.active) {
          disconnect().then(() => {
            statusLbl.set_label("Disconnected")
            loadNetworks()
          })
          return
        }
        if (n.security) {
          pendingSsid = n.ssid
          pwdLbl.set_label(`Password for "${n.ssid}"`)
          pwdEntry.set_text("")
          pwdBox.set_visible(true)
          pwdEntry.grab_focus()
        } else {
          statusLbl.set_label(`Connecting to ${n.ssid}…`)
          execAsync(["nmcli", "dev", "wifi", "connect", n.ssid])
            .then(() => {
              statusLbl.set_label(`Connected to ${n.ssid}`)
              loadNetworks()
            })
            .catch(() => statusLbl.set_label("Connection failed"))
        }
      })

      row.append(ssidLbl)
      row.append(bars)
      row.append(lock)
      row.append(connBtn)
      netList.append(row)
    })
  }

  const loadNetworks = () => {
    statusLbl.set_label("Loading…")
    scanNetworks()
      .then((nets) => {
        renderNetworks(nets)
        statusLbl.set_label(`${nets.length} networks`)
      })
      .catch(() => statusLbl.set_label("Error loading networks"))
  }

  // password connect
  pwdConnect.connect("clicked", () => {
    const pwd = pwdEntry.get_text()
    if (!pwd || !pendingSsid) return
    pwdBox.set_visible(false)
    statusLbl.set_label(`Connecting to ${pendingSsid}…`)
    execAsync(["nmcli", "dev", "wifi", "connect", pendingSsid, "password", pwd])
      .then(() => {
        statusLbl.set_label(`Connected to ${pendingSsid}`)
        loadNetworks()
      })
      .catch(() => {
        statusLbl.set_label("Wrong password or failed")
        pwdBox.set_visible(true)
      })
  })

  pwdEntry.connect("activate", () => pwdConnect.activate())
  pwdCancel.connect("clicked", () => {
    pwdBox.set_visible(false)
    pendingSsid = ""
  })

  scanBtn.connect("clicked", () => {
    if (scanning) return
    scanning = true
    scanBtn.set_label("Scanning…")
    rescan()
      .then(() => {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
          loadNetworks()
          scanBtn.set_label("⟳ Scan")
          scanning = false
          return GLib.SOURCE_REMOVE
        })
      })
      .catch(() => {
        scanBtn.set_label("⟳ Scan")
        scanning = false
      })
  })

  mainBox.append(wifiBox)
  popover.set_child(mainBox)

  // ── hover logic ────────────────────────────────────────────
  let anchorHovered = false,
    popHovered = false,
    hideTimer = 0
  const cancelHide = () => {
    if (hideTimer) {
      GLib.source_remove(hideTimer)
      hideTimer = 0
    }
  }
  const scheduleHide = () => {
    cancelHide()
    hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      if (!anchorHovered && !popHovered) popover.popdown()
      hideTimer = 0
      return GLib.SOURCE_REMOVE
    })
  }

  // ── sidebar buttons (unchanged) ───────────────────────────
  const box = (
    <box
      cssClasses={["controls"]}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={4}
      halign={Gtk.Align.CENTER}
    >
      <box cssClasses={["ctrl-item"]} halign={Gtk.Align.CENTER} spacing={3}>
        <label cssClasses={["ctrl-icon"]} label="󰌌" />
        <label cssClasses={["ctrl-label"]} label={keyboard} />
      </box>
      <button
        cssClasses={["ctrl-item"]}
        halign={Gtk.Align.CENTER}
        onClicked={() => execAsync(["easyeffects"]).catch(() => {})}
      >
        <label cssClasses={["ctrl-icon"]} label="󰺹" />
      </button>
      <button
        cssClasses={muted((m: string) =>
          m.trim() === "1" ? ["ctrl-item"] : ["ctrl-item", "ctrl-active"],
        )}
        halign={Gtk.Align.CENTER}
        onClicked={() => toggleMute()}
      >
        <label
          cssClasses={["ctrl-icon"]}
          label={muted((m: string) => (m.trim() === "1" ? "󰝟" : "󰕾"))}
        />
      </button>
      <button
        cssClasses={btOn((b: string) =>
          b.trim() === "1" ? ["ctrl-item", "ctrl-active"] : ["ctrl-item"],
        )}
        halign={Gtk.Align.CENTER}
        onClicked={() => toggleBt()}
      >
        <label
          cssClasses={["ctrl-icon"]}
          label={btOn((b: string) => (b.trim() === "1" ? "󰂯" : "󰂲"))}
        />
      </button>
      <button
        cssClasses={wifiOn((w: string) =>
          w.trim() === "1" ? ["ctrl-item", "ctrl-active"] : ["ctrl-item"],
        )}
        halign={Gtk.Align.CENTER}
        onClicked={() => toggleWifi()}
      >
        <label
          cssClasses={["ctrl-icon"]}
          label={wifiOn((w: string) => (w.trim() === "1" ? "󰖩" : "󰤭"))}
        />
      </button>
    </box>
  )

  box.connect("realize", () => {
    popover.set_parent(box)
    syncMute(muted.get())
    syncBt(btOn.get())
    syncVol(volPct.get())
    // fetch bt device
    execAsync([
      "bash",
      "-c",
      "bluetoothctl devices Connected 2>/dev/null | grep -v 'controller' | head -1 | cut -d' ' -f3-",
    ])
      .then((v) => btDeviceLbl.set_label(v.trim() || "No device"))
      .catch(() => {})
  })

  const motion = new Gtk.EventControllerMotion()
  motion.connect("enter", () => {
    anchorHovered = true
    cancelHide()
    if (!popover.get_visible()) loadNetworks()
    popover.popup()
  })
  motion.connect("leave", () => {
    anchorHovered = false
    scheduleHide()
  })
  box.add_controller(motion)

  const popMotion = new Gtk.EventControllerMotion()
  popMotion.connect("enter", () => {
    popHovered = true
    cancelHide()
  })
  popMotion.connect("leave", () => {
    popHovered = false
    scheduleHide()
  })
  mainBox.add_controller(popMotion)

  return box
}
