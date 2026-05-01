import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import {
  wifiOn,
  btOn,
  muted,
  volPct,
  keyboard,
  toggleWifi,
  toggleBt,
  toggleMute,
} from "./state"

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
  try {
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
        const [ssid, signal, security, active] = l.split(":")
        return {
          ssid: ssid || "",
          signal: parseInt(signal) || 0,
          security: security || "",
          active: active?.trim() === "yes",
        }
      })
      .filter((n) => n.ssid && !seen.has(n.ssid) && (seen.add(n.ssid), true))
      .sort((a, b) => b.signal - a.signal)
  } catch {
    return []
  }
}

export default function Controls() {
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

  // Audio + Bluetooth top row
  const topRow = new Gtk.Box({ spacing: 8 })

  // Audio panel
  const audioBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    hexpand: true,
  })
  audioBox.add_css_class("ctrl-panel")
  audioBox.append(
    new Gtk.Label({
      label: "AUDIO",
      cssClasses: ["ctrl-panel-header"],
      halign: Gtk.Align.START,
    }),
  )

  // Mute
  const muteRow = new Gtk.Box({ spacing: 6, valign: Gtk.Align.CENTER })
  const muteIcn = new Gtk.Label({ cssClasses: ["ctrl-pop-icon"] })
  const muteLbl = new Gtk.Label({
    cssClasses: ["ctrl-pop-state"],
    hexpand: true,
    halign: Gtk.Align.START,
  })
  const muteBtn = new Gtk.Button({ cssClasses: ["ctrl-mini-btn"] })

  const syncMute = (isMuted: boolean) => {
    muteIcn.set_label(isMuted ? "󰝟" : "󰕾")
    muteLbl.set_label(isMuted ? "Muted" : "Unmuted")
    muteBtn.set_child(new Gtk.Label({ label: isMuted ? "Unmute" : "Mute" }))
  }
  muteBtn.connect("clicked", toggleMute)
  muted.subscribe(() => syncMute(muted.get().trim() === "1"))
  syncMute(muted.get().trim() === "1")

  muteRow.append(muteIcn)
  muteRow.append(muteLbl)
  muteRow.append(muteBtn)
  audioBox.append(muteRow)

  // Volume
  const volRow = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  const volTop = new Gtk.Box({ spacing: 0 })
  volTop.append(
    new Gtk.Label({
      label: "Volume",
      cssClasses: ["ctrl-pop-detail"],
      hexpand: true,
      halign: Gtk.Align.START,
    }),
  )
  const volNum = new Gtk.Label({ cssClasses: ["ctrl-pop-detail"] })
  volTop.append(volNum)

  const volTrack = new Gtk.Box({ cssClasses: ["ctrl-pop-vol-track"] })
  volTrack.set_size_request(80, 4)
  const volFill = new Gtk.Box({ cssClasses: ["ctrl-pop-vol-fill"] })
  volTrack.append(volFill)

  const syncVol = (p: string) => {
    const v = parseInt(p.trim()) || 0
    volNum.set_label(v + "%")
    volFill.set_size_request(Math.round(v * 0.8), 4)
  }
  volPct.subscribe(() => syncVol(volPct.get()))
  syncVol(volPct.get())

  volRow.append(volTop)
  volRow.append(volTrack)
  audioBox.append(volRow)

  const fxBtn = new Gtk.Button({
    label: "EasyEffects",
    cssClasses: ["ctrl-mini-btn"],
  })
  fxBtn.connect("clicked", () => execAsync(["easyeffects"]).catch(() => {}))
  audioBox.append(fxBtn)

  topRow.append(audioBox)

  // Bluetooth panel
  const btBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    hexpand: true,
  })
  btBox.add_css_class("ctrl-panel")
  btBox.append(
    new Gtk.Label({
      label: "BLUETOOTH",
      cssClasses: ["ctrl-panel-header"],
      halign: Gtk.Align.START,
    }),
  )

  const btStatusRow = new Gtk.Box({ spacing: 6 })
  const btIcn = new Gtk.Label({ cssClasses: ["ctrl-pop-icon"] })
  const btStateLbl = new Gtk.Label({
    cssClasses: ["ctrl-pop-state"],
    hexpand: true,
    halign: Gtk.Align.START,
  })
  const btToggleBtn = new Gtk.Button({ cssClasses: ["ctrl-mini-btn"] })
  const btToggleLbl = new Gtk.Label()

  btToggleBtn.set_child(btToggleLbl)

  const syncBt = (v: string) => {
    const on = v.trim() === "1"
    btIcn.set_label(on ? "󰂯" : "󰂲")
    btStateLbl.set_label(on ? "On" : "Off")
    btToggleLbl.set_label(on ? "Disable" : "Enable")
  }

  btToggleBtn.connect("clicked", () => {
    toggleBt()
  })
  syncBt(btOn.get())
  btOn.subscribe(() => syncBt(btOn.get()))

  btStatusRow.append(btIcn)
  btStatusRow.append(btStateLbl)
  btStatusRow.append(btToggleBtn)
  btBox.append(btStatusRow)

  const btDeviceLbl = new Gtk.Label({
    label: "No device",
    cssClasses: ["ctrl-pop-detail"],
    halign: Gtk.Align.START,
    ellipsize: 3,
    maxWidthChars: 12,
  })
  btBox.append(btDeviceLbl)

  const btToolBtn = new Gtk.Button({
    label: "bluetui",
    cssClasses: ["ctrl-mini-btn"],
  })
  btToolBtn.connect("clicked", () =>
    execAsync(["bash", "-c", "kitty --class floating_kitty bluetui"]).catch(
      () => {},
    ),
  )
  btBox.append(btToolBtn)

  topRow.append(btBox)
  mainBox.append(topRow)

  mainBox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }))

  // WiFi panel
  const wifiBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
  })
  wifiBox.add_css_class("ctrl-panel")

  const wifiHeaderRow = new Gtk.Box({ spacing: 6 })
  wifiHeaderRow.append(
    new Gtk.Label({
      label: "WI-FI",
      cssClasses: ["ctrl-panel-header"],
      hexpand: true,
      halign: Gtk.Align.START,
    }),
  )

  const wifiToggleBtn = new Gtk.Button({ cssClasses: ["ctrl-mini-btn"] })
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

  const scanBtn = new Gtk.Button({
    label: "⟳ Scan",
    cssClasses: ["ctrl-mini-btn"],
  })

  wifiHeaderRow.append(wifiToggleBtn)
  wifiHeaderRow.append(scanBtn)
  wifiBox.append(wifiHeaderRow)

  // Network list
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

  // Password box
  const pwdBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  pwdBox.set_visible(false)

  const pwdLbl = new Gtk.Label({
    label: "Password",
    cssClasses: ["ctrl-pop-detail"],
    halign: Gtk.Align.START,
  })
  const pwdEntry = new Gtk.Entry()
  pwdEntry.set_visibility(false)
  pwdEntry.set_placeholder_text("Enter password…")
  pwdEntry.add_css_class("ctrl-pwd-entry")

  const pwdBtnRow = new Gtk.Box({ spacing: 6, halign: Gtk.Align.END })
  const pwdCancel = new Gtk.Button({
    label: "Cancel",
    cssClasses: ["ctrl-mini-btn"],
  })
  const pwdConnect = new Gtk.Button({
    label: "Connect",
    cssClasses: ["ctrl-mini-btn-accent"],
  })

  pwdBtnRow.append(pwdCancel)
  pwdBtnRow.append(pwdConnect)
  pwdBox.append(pwdLbl)
  pwdBox.append(pwdEntry)
  pwdBox.append(pwdBtnRow)
  wifiBox.append(pwdBox)

  const statusLbl = new Gtk.Label({
    label: "",
    cssClasses: ["ctrl-pop-detail"],
    halign: Gtk.Align.START,
  })
  wifiBox.append(statusLbl)

  mainBox.append(wifiBox)
  popover.set_child(mainBox)

  // Network logic
  let pendingSsid = ""
  let scanning = false

  const renderNetworks = (networks: Network[]) => {
    let c = netList.get_first_child()
    while (c) {
      netList.remove(c)
      c = netList.get_first_child()
    }

    if (!networks.length) {
      netList.append(
        new Gtk.Label({
          label: "No networks found",
          cssClasses: ["ctrl-pop-detail"],
        }),
      )
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
          execAsync(["nmcli", "dev", "disconnect", "wifi"]).catch(() => {})
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
            .then(() => loadNetworks())
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

  scanBtn.connect("clicked", () => {
    if (scanning) return
    scanning = true
    scanBtn.set_label("Scanning…")
    execAsync(["nmcli", "dev", "wifi", "rescan"])
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

  // Compact controls bar
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
    loadNetworks()
  })

  // Hover logic
  let anchorHovered = false
  let popHovered = false
  let hideTimer = 0

  const cancelHide = () => {
    if (hideTimer) GLib.source_remove(hideTimer)
    hideTimer = 0
  }

  const scheduleHide = () => {
    cancelHide()
    hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      if (!anchorHovered && !popHovered) popover.popdown()
      hideTimer = 0
      return GLib.SOURCE_REMOVE
    })
  }

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
