import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"

const KEYBINDS_PATH = `${GLib.get_home_dir()}/.config/hypr/hyprland/keybinds.conf`
import GLib from "gi://GLib"

// ── Key label normalization ────────────────────────────────────
const KEY_MAP: Record<string, string> = {
  super: "󰣇", // nf-linux-archlinux
  super_l: "󰣇",
  super_r: "󰣇",
  ctrl: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  return: "Enter",
  space: "Space",
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
  page_down: "PgDn",
  page_up: "PgUp",
  print: "PrtSc",
  delete: "Del",
  escape: "Esc",
  minus: "−",
  equal: "=",
  semicolon: ";",
  apostrophe: "'",
  period: ".",
  slash: "/",
  bracketleft: "[",
  bracketright: "]",
  "mouse:272": "LMB",
  "mouse:273": "RMB",
  mouse_up: "Scroll↑",
  mouse_down: "Scroll↓",
  xf86monbrightnessup: "Bri+",
  xf86monbrightnessdown: "Bri−",
  xf86audioraisevolume: "Vol+",
  xf86audiolowervolume: "Vol−",
  xf86audiomute: "Mute",
  xf86audiomicmute: "MicMute",
  xf86audionext: "Next",
  xf86audioprev: "Prev",
  xf86audioplay: "Play",
  xf86audiopause: "Pause",
  xf86audiostop: "Stop",
}

function normalizeKey(raw: string): string {
  const lower = raw.trim().toLowerCase()
  if (KEY_MAP[lower]) return KEY_MAP[lower]

  const codeMatch = lower.match(/^code:(\d+)$/)
  if (codeMatch) {
    const n = parseInt(codeMatch[1]) - 9
    return n === 10 ? "0" : String(n)
  }

  return raw.trim().length === 1 ? raw.trim().toUpperCase() : raw.trim()
}

function parseMods(modStr: string): string[] {
  if (!modStr.trim()) return []
  return modStr
    .split("+")
    .map((m) => normalizeKey(m.trim()))
    .filter(Boolean)
}

// ── Parser ────────────────────────────────────────────────────
interface Bind {
  keys: string[]
  desc: string
}
interface Section {
  name: string
  binds: Bind[]
}

// extract a human-readable desc from exec command as fallback
function execToDesc(exec: string): string {
  const e = exec.trim()

  const agsToggle = e.match(/ags\s+toggle\s+(\S+)/)
  if (agsToggle)
    return agsToggle[1].charAt(0).toUpperCase() + agsToggle[1].slice(1)

  if (e.includes("playerctl next")) return "Next track"
  if (e.includes("playerctl previous")) return "Prev track"
  if (e.includes("playerctl play-pause")) return "Play / Pause"
  if (e.includes("playerctl stop")) return "Stop"

  const cArg = e.match(/-c\s+(\S+)/)
  if (cArg) return cArg[1].charAt(0).toUpperCase() + cArg[1].slice(1)

  if (e.includes("brightnessctl"))
    return e.includes("+") ? "Brightness +" : "Brightness −"
  if (e.includes("wpctl set-volume") && e.includes("+")) return "Volume +"
  if (e.includes("wpctl set-volume") && !e.includes("+")) return "Volume −"
  if (e.includes("wpctl set-mute") && e.includes("SOURCE")) return "Mute mic"
  if (e.includes("wpctl set-mute")) return "Mute speaker"

  const words = e
    .split(/\s+/)
    .filter(
      (w) => !w.startsWith("-") && !w.startsWith("%") && !w.startsWith("@"),
    )
  const last = words[words.length - 1] || words[0]
  return last.charAt(0).toUpperCase() + last.slice(1)
}

function parseKeybinds(raw: string): Section[] {
  const lines = raw.split("\n")
  const sections: Section[] = []
  let currentSection: Section | null = null
  let pendingDesc = ""

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("##!")) {
      const name = trimmed.replace(/^##!\s*/, "").trim()
      if (name && name !== "Virtual machines") {
        currentSection = { name, binds: [] }
        sections.push(currentSection)
      }
      pendingDesc = ""
      continue
    }

    if (trimmed.startsWith("#") && !trimmed.startsWith("#bind")) {
      pendingDesc = trimmed.replace(/^#\s*/, "").trim()
      continue
    }

    if (!trimmed) {
      pendingDesc = ""
      continue
    }

    const bindMatch = trimmed.match(
      /^bind[mled]*\s*=\s*([^,]*),\s*([^,]+),\s*(?:exec,\s*)?(.*)$/,
    )
    if (bindMatch && currentSection) {
      const mods = parseMods(bindMatch[1])
      const key = normalizeKey(bindMatch[2].trim())
      const execCmd = bindMatch[3].trim()

      if (key === "LMB" || key === "RMB") continue

      const keys = [...mods, key].filter((k, i, arr) => arr.indexOf(k) === i)

      const isJustSuperDupe = keys.every((k) => k === "󰣇") && keys.length > 1
      if (isJustSuperDupe) continue

      if (!pendingDesc && key.match(/^\d+$/) && !execCmd.includes("workspace"))
        continue

      const desc = pendingDesc || execToDesc(execCmd)

      currentSection.binds.push({ keys, desc })
    }
  }

  return sections
    .map((s) => ({
      ...s,
      binds: s.binds.filter(
        (b, i, arr) =>
          arr.findIndex(
            (x) => x.desc === b.desc && x.keys.join() === b.keys.join(),
          ) === i,
      ),
    }))
    .filter((s) => s.binds.length > 0)
}

// ── Cyber Kill Chain ──────────────────────────────────────────
interface KillPhase {
  phase: number
  code: string
  name: string
  desc: string
  tools: string[]
}

const KILL_CHAIN: KillPhase[] = [
  {
    phase: 1,
    code: "RECON",
    name: "Reconnaissance",
    desc: "Passive & active intel gathering on the target.",
    tools: ["nmap", "shodan", "theHarvester", "whois"],
  },
  {
    phase: 2,
    code: "WEAPON",
    name: "Weaponization",
    desc: "Couple exploit with backdoor into deliverable payload.",
    tools: ["msfvenom", "veil", "shellter"],
  },
  {
    phase: 3,
    code: "DELIVER",
    name: "Delivery",
    desc: "Transmit weapon via phishing, USB, or watering hole.",
    tools: ["gophish", "setoolkit", "evilginx"],
  },
  {
    phase: 4,
    code: "EXPLOIT",
    name: "Exploitation",
    desc: "Trigger payload against a vulnerability.",
    tools: ["metasploit", "sqlmap", "burpsuite"],
  },
  {
    phase: 5,
    code: "INSTALL",
    name: "Installation",
    desc: "Persistent implant survives reboots.",
    tools: ["mimikatz", "impacket", "evil-winrm"],
  },
  {
    phase: 6,
    code: "C2",
    name: "Command & Control",
    desc: "Two-way comms channel between operator and implant.",
    tools: ["sliver", "havoc", "covenant"],
  },
  {
    phase: 7,
    code: "EXFIL",
    name: "Exfiltration",
    desc: "Complete objective — extract data or cause disruption.",
    tools: ["dnscat2", "cloakify", "curlexfil"],
  },
]

interface Port {
  port: string
  proto: string
  service: string
  risk: "critical" | "medium" | "low"
}
const PORTS: Port[] = [
  { port: "21", proto: "TCP", service: "FTP", risk: "critical" },
  { port: "22", proto: "TCP", service: "SSH", risk: "medium" },
  { port: "23", proto: "TCP", service: "Telnet", risk: "critical" },
  { port: "25", proto: "TCP", service: "SMTP", risk: "medium" },
  { port: "53", proto: "UDP", service: "DNS", risk: "medium" },
  { port: "80", proto: "TCP", service: "HTTP", risk: "medium" },
  { port: "139", proto: "TCP", service: "NetBIOS", risk: "critical" },
  { port: "443", proto: "TCP", service: "HTTPS", risk: "low" },
  { port: "445", proto: "TCP", service: "SMB", risk: "critical" },
  { port: "1433", proto: "TCP", service: "MSSQL", risk: "critical" },
  { port: "3306", proto: "TCP", service: "MySQL", risk: "critical" },
  { port: "3389", proto: "TCP", service: "RDP", risk: "critical" },
  { port: "5432", proto: "TCP", service: "PostgreSQL", risk: "medium" },
  { port: "5900", proto: "TCP", service: "VNC", risk: "critical" },
  { port: "6379", proto: "TCP", service: "Redis", risk: "critical" },
  { port: "8080", proto: "TCP", service: "HTTP-alt", risk: "medium" },
  { port: "27017", proto: "TCP", service: "MongoDB", risk: "critical" },
]

// ── UI helpers ────────────────────────────────────────────────
function KeyChip(label: string) {
  const lbl = new Gtk.Label({ label })
  lbl.add_css_class("cs-key")

  if (label === "󰣇") lbl.add_css_class("cs-key-super")
  return lbl
}

function BindRow(keys: string[], desc: string) {
  const row = new Gtk.Box({
    spacing: 0,
    orientation: Gtk.Orientation.HORIZONTAL,
  })
  row.add_css_class("cs-bind-row")

  const keyBox = new Gtk.Box({ spacing: 3 })
  keyBox.add_css_class("cs-key-group")
  keys.forEach((k) => keyBox.append(KeyChip(k)))

  const descLbl = new Gtk.Label({ label: desc })
  descLbl.add_css_class("cs-bind-desc")
  descLbl.set_halign(Gtk.Align.START)
  descLbl.set_hexpand(true)
  descLbl.set_ellipsize(3)

  row.append(keyBox)
  row.append(descLbl)
  return row
}

function SectionBlock(section: Section) {
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  box.add_css_class("cs-section")

  const hdr = new Gtk.Label({ label: section.name.toUpperCase() })
  hdr.add_css_class("cs-section-header")
  hdr.set_halign(Gtk.Align.START)
  box.append(hdr)

  section.binds.forEach((b) => box.append(BindRow(b.keys, b.desc)))
  return box
}

function KeybindsTab() {
  const scroll = new Gtk.ScrolledWindow()
  scroll.set_vexpand(true)
  scroll.set_hexpand(true)
  scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

  const grid = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
  })
  grid.add_css_class("cs-grid")

  const col1 = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
  })
  const col2 = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
  })
  col1.set_hexpand(true)
  col2.set_hexpand(true)
  col1.add_css_class("cs-col")
  col2.add_css_class("cs-col")

  const loadingLbl = new Gtk.Label({ label: "Loading keybinds…" })
  loadingLbl.add_css_class("cs-loading")
  col1.append(loadingLbl)

  grid.append(col1)
  grid.append(
    new Gtk.Separator({
      orientation: Gtk.Orientation.VERTICAL,
      css_classes: ["cs-col-sep"],
    }),
  )
  grid.append(col2)
  scroll.set_child(grid)

  // parse on load
  execAsync(["bash", "-c", `cat ${KEYBINDS_PATH}`])
    .then((raw) => {
      let c = col1.get_first_child()
      while (c) {
        col1.remove(c)
        c = col1.get_first_child()
      }

      const sections = parseKeybinds(raw)
      const cols = [col1, col2]
      sections.forEach((s, i) => cols[i % 2].append(SectionBlock(s)))
    })
    .catch(() => {
      loadingLbl.set_label("Could not read keybinds.conf")
    })

  return scroll
}

function PhaseCard(p: KillPhase) {
  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 5,
  })
  card.add_css_class("cs-phase-card")
  card.set_hexpand(true)

  const badge = new Gtk.Box({ spacing: 5 })
  const num = new Gtk.Label({ label: String(p.phase).padStart(2, "0") })
  num.add_css_class("cs-phase-num")
  const code = new Gtk.Label({ label: p.code })
  code.add_css_class("cs-phase-code")
  badge.append(num)
  badge.append(code)

  const name = new Gtk.Label({ label: p.name })
  name.add_css_class("cs-phase-name")
  name.set_halign(Gtk.Align.START)
  name.set_xalign(0)

  const desc = new Gtk.Label({ label: p.desc })
  desc.add_css_class("cs-phase-desc")
  desc.set_halign(Gtk.Align.START)
  desc.set_xalign(0)
  desc.set_wrap(true)

  const tools = new Gtk.Box({ spacing: 3 })
  p.tools.forEach((t) => {
    const chip = new Gtk.Label({ label: t })
    chip.add_css_class("cs-tool-chip")
    tools.append(chip)
  })

  card.append(badge)
  card.append(name)
  card.append(desc)
  card.append(tools)
  return card
}

function PortRow(p: Port) {
  const row = new Gtk.Box({ spacing: 0 })
  row.add_css_class("cs-port-row")

  const port = new Gtk.Label({ label: p.port })
  port.add_css_class("cs-port-num")
  port.set_width_chars(7)
  port.set_xalign(0)

  const proto = new Gtk.Label({ label: p.proto })
  proto.add_css_class("cs-port-proto")
  proto.set_width_chars(5)
  proto.set_xalign(0)

  const svc = new Gtk.Label({ label: p.service })
  svc.add_css_class("cs-port-svc")
  svc.set_hexpand(true)
  svc.set_xalign(0)

  const risk = new Gtk.Label({ label: p.risk.toUpperCase() })
  risk.add_css_class(`cs-risk-${p.risk}`)

  row.append(port)
  row.append(proto)
  row.append(svc)
  row.append(risk)
  return row
}

function CyberTab() {
  const scroll = new Gtk.ScrolledWindow()
  scroll.set_vexpand(true)
  scroll.set_hexpand(true)
  scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

  const outer = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 18,
  })
  outer.add_css_class("cs-cyber-outer")

  const chainHdr = new Gtk.Label({
    label: "CYBER KILL CHAIN — LOCKHEED MARTIN MODEL",
  })
  chainHdr.add_css_class("cs-cyber-header")
  chainHdr.set_halign(Gtk.Align.START)
  outer.append(chainHdr)

  const chainScroll = new Gtk.ScrolledWindow()
  chainScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.NEVER)
  const chainRow = new Gtk.Box({ spacing: 6 })
  chainRow.add_css_class("cs-chain-row")
  KILL_CHAIN.forEach((p) => chainRow.append(PhaseCard(p)))
  chainScroll.set_child(chainRow)
  outer.append(chainScroll)

  const arrow = new Gtk.Label({ label: "01 → 02 → 03 → 04 → 05 → 06 → 07" })
  arrow.add_css_class("cs-chain-arrow")
  arrow.set_halign(Gtk.Align.CENTER)
  outer.append(arrow)

  outer.append(new Gtk.Separator({ css_classes: ["cs-col-sep"] }))

  const portsHdr = new Gtk.Label({ label: "COMMON ATTACK SURFACE PORTS" })
  portsHdr.add_css_class("cs-cyber-header")
  portsHdr.set_halign(Gtk.Align.START)
  outer.append(portsHdr)

  const colHdr = new Gtk.Box({ spacing: 0 })
  colHdr.add_css_class("cs-port-header-row")
  const hPort = new Gtk.Label({ label: "PORT" })
  hPort.set_width_chars(7)
  hPort.set_xalign(0)
  const hProto = new Gtk.Label({ label: "PROTO" })
  hProto.set_width_chars(5)
  hProto.set_xalign(0)
  const hSvc = new Gtk.Label({ label: "SERVICE" })
  hSvc.set_hexpand(true)
  hSvc.set_xalign(0)
  const hRisk = new Gtk.Label({ label: "RISK" })
  ;[hPort, hProto, hSvc, hRisk].forEach((l) => {
    l.add_css_class("cs-port-col-lbl")
    colHdr.append(l)
  })
  outer.append(colHdr)

  const portGrid = new Gtk.Box({ spacing: 12 })
  const half = Math.ceil(PORTS.length / 2)
  const pc1 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  const pc2 = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 1 })
  pc1.set_hexpand(true)
  pc2.set_hexpand(true)
  PORTS.slice(0, half).forEach((p) => pc1.append(PortRow(p)))
  PORTS.slice(half).forEach((p) => pc2.append(PortRow(p)))
  portGrid.append(pc1)
  portGrid.append(
    new Gtk.Separator({
      orientation: Gtk.Orientation.VERTICAL,
      css_classes: ["cs-col-sep"],
    }),
  )
  portGrid.append(pc2)
  outer.append(portGrid)

  scroll.set_child(outer)
  return scroll
}

// ── Tab bar ───────────────────────────────────────────────────
function TabBar(labels: string[], stack: Gtk.Stack) {
  let active = 0
  const bar = new Gtk.Box({ spacing: 0 })
  bar.add_css_class("cs-tab-bar")

  const btns = labels.map((label, i) => {
    const btn = new Gtk.Button()
    btn.add_css_class("cs-tab-btn")
    if (i === 0) btn.add_css_class("cs-tab-active")
    btn.set_child(new Gtk.Label({ label }))
    btn.connect("clicked", () => {
      btns[active]?.remove_css_class("cs-tab-active")
      active = i
      btn.add_css_class("cs-tab-active")
      stack.set_visible_child_name(`tab-${i}`)
    })
    bar.append(btn)
    return btn
  })
  return bar
}

// ── Window ────────────────────────────────────────────────────
let sheetRef: any = null

export default function CheatSheet() {
  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
  })
  card.add_css_class("cs-card")
  card.set_size_request(980, 660)

  const titleBar = new Gtk.Box({ spacing: 0 })
  titleBar.add_css_class("cs-title-bar")
  const title = new Gtk.Label({ label: "CHEAT SHEET" })
  title.add_css_class("cs-title")
  title.set_hexpand(true)
  title.set_halign(Gtk.Align.CENTER)
  const closeBtn = new Gtk.Button({ label: "✕" })
  closeBtn.add_css_class("cs-close-btn")
  closeBtn.connect("clicked", () => sheetRef?.set_visible(false))
  titleBar.append(title)
  titleBar.append(closeBtn)
  card.append(titleBar)

  const stack = new Gtk.Stack()
  stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  stack.set_transition_duration(100)
  stack.set_vexpand(true)
  stack.add_named(KeybindsTab(), "tab-0")
  stack.add_named(CyberTab(), "tab-1")

  card.append(TabBar(["⌨  Keybinds", "  Cyber Intel"], stack))
  card.append(stack)

  const overlay = new Gtk.Overlay()
  const backdrop = new Gtk.Box()
  backdrop.set_hexpand(true)
  backdrop.set_vexpand(true)
  overlay.set_child(backdrop)
  card.set_halign(Gtk.Align.CENTER)
  card.set_valign(Gtk.Align.CENTER)
  overlay.add_overlay(card)

  const backdropClick = new Gtk.GestureClick()
  backdropClick.connect("pressed", () => sheetRef?.set_visible(false))
  backdrop.add_controller(backdropClick)

  const win = (
    <window
      name="cheatsheet"
      cssClasses={["cs-window"]}
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

  const key = new Gtk.EventControllerKey()
  key.connect("key-pressed", (_: any, kv: number) => {
    if (kv === 65307) sheetRef?.set_visible(false)
    return false
  })
  win.add_controller(key)

  sheetRef = win
  return win
}
