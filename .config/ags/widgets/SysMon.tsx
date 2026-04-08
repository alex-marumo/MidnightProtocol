import { Gtk } from "ags/gtk4"
import { createState } from "ags"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import Cairo from "cairo"

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

// ── Stats ────────────────────────────────────────
let prevIdle = 0,
  prevTotal = 0

async function getCpuUsage(): Promise<number> {
  const raw = await execAsync([
    "bash",
    "-c",
    "awk 'NR==1{print $2,$3,$4,$5,$6,$7,$8}' /proc/stat",
  ])
  const [user, nice, sys, idle, iowait, irq, softirq] = raw
    .trim()
    .split(" ")
    .map(Number)
  const total = user + nice + sys + idle + iowait + irq + softirq
  const usage =
    prevTotal > 0
      ? Math.round((1 - (idle - prevIdle) / (total - prevTotal)) * 100)
      : 0
  prevIdle = idle
  prevTotal = total
  return Math.max(0, Math.min(100, usage))
}

async function getRamInfo(): Promise<{ pct: number; str: string }> {
  const raw = await execAsync([
    "bash",
    "-c",
    "free -m | awk '/Mem/{print $2, $3}'",
  ])
  const [total, used] = raw.trim().split(" ").map(Number)
  return { pct: Math.round((used / total) * 100), str: `${used}/${total}MB` }
}

async function getSwapInfo(): Promise<{ pct: number; str: string }> {
  const raw = await execAsync([
    "bash",
    "-c",
    "free -m | awk '/Swap/{print $2, $3}'",
  ])
  const [total, used] = raw.trim().split(" ").map(Number)
  if (!total) return { pct: 0, str: "none" }
  return { pct: Math.round((used / total) * 100), str: `${used}/${total}MB` }
}

async function getUptime(): Promise<string> {
  const raw = await execAsync(["bash", "-c", "uptime -p | sed 's/up //'"])
  return raw.trim()
}

const [cpu, setCpu] = createState(0)
const [ram, setRam] = createState(0)
const [swap, setSwap] = createState(0)
const [uptime, setUptime] = createState("—")

async function pollStats() {
  try {
    const [c, ri, si, up] = await Promise.all([
      getCpuUsage(),
      getRamInfo(),
      getSwapInfo(),
      getUptime(),
    ])
    setCpu(c)
    setRam(ri.pct)
    setSwap(si.pct)
    setUptime(up)
  } catch (_) {}
}

pollStats()
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
  pollStats()
  return GLib.SOURCE_CONTINUE
})

// ── Retro Circular Ring ─────────────────────────────
function RetroRing({
  drawIcon,
  value,
  hex,
}: {
  drawIcon: (
    cr: any,
    cx: number,
    cy: number,
    r: number,
    g: number,
    b: number,
  ) => void
  value: any
  hex: string
}) {
  const SIZE = 34
  const STROKE = 2.4
  const R = (SIZE - STROKE) / 2
  const [rr, gg, bb] = hexToRgb(hex)

  const da = new Gtk.DrawingArea()
  da.set_size_request(SIZE, SIZE)

  let pct = 0

  da.set_draw_func((_, cr) => {
    const cx = SIZE / 2
    const cy = SIZE / 2
    const start = -Math.PI / 2

    cr.setLineWidth(1.1)
    cr.setSourceRGBA(1, 1, 1, 0.06)
    cr.arc(cx, cy, R, 0, 2 * Math.PI)
    cr.stroke()

    if (pct > 0) {
      cr.setLineWidth(STROKE)
      cr.setSourceRGBA(rr, gg, bb, 0.96)
      cr.setLineCap(Cairo.LineCap.BUTT)
      cr.arc(cx, cy, R, start, start + pct * 2 * Math.PI)
      cr.stroke()
    }

    drawIcon(cr, cx, cy, rr, gg, bb)
  })

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
    pct = (value() as number) / 100
    da.queue_draw()
    return GLib.SOURCE_CONTINUE
  })

  return da
}

export default function SysMon() {
  const root = new Gtk.Box()
  root.set_orientation(Gtk.Orientation.VERTICAL)
  root.set_halign(Gtk.Align.CENTER)
  root.set_spacing(6)
  root.add_css_class("sysmon")

  root.append(
    RetroRing({ drawIcon: drawCpu, value: () => cpu.get(), hex: "#4bddc0" }),
  )
  root.append(
    RetroRing({ drawIcon: drawRam, value: () => ram.get(), hex: "#4bddc0" }),
  )
  root.append(
    RetroRing({ drawIcon: drawSwap, value: () => swap.get(), hex: "#e7be40" }),
  )

  const popover = new Gtk.Popover()
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.RIGHT)
  popover.add_css_class("sysmon-popover")
  popover.set_autohide(false)

  const statRow = new Gtk.Box()
  statRow.set_spacing(16)
  statRow.set_halign(Gtk.Align.CENTER)
  statRow.add_css_class("sysmon-stat-row")
  statRow.append(statCol("RAM", () => ram.get(), "%", "#4bddc0"))
  statRow.append(statCol("CPU", () => cpu.get(), "%", "#4bddc0"))
  statRow.append(statCol("SWAP", () => swap.get(), "%", "#e7be40"))

  const div = new Gtk.Separator()
  div.set_orientation(Gtk.Orientation.HORIZONTAL)
  div.add_css_class("sysmon-divider")

  const uptimeLbl = new Gtk.Label()
  uptimeLbl.add_css_class("sysmon-uptime")
  uptimeLbl.set_halign(Gtk.Align.CENTER)
  uptimeLbl.set_label("up —")

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
    uptimeLbl.set_label(`up ${uptime.get()}`)
    return GLib.SOURCE_CONTINUE
  })

  const card = new Gtk.Box()
  card.set_orientation(Gtk.Orientation.VERTICAL)
  card.set_spacing(10)
  card.add_css_class("sysmon-card")
  card.append(statRow)
  card.append(div)
  card.append(uptimeLbl)
  popover.set_child(card)

  let anchorHovered = false,
    popoverHovered = false,
    hideTimer = 0

  const cancelHide = () => {
    if (hideTimer) GLib.source_remove(hideTimer)
    hideTimer = 0
  }
  const scheduleHide = () => {
    cancelHide()
    hideTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
      if (!anchorHovered && !popoverHovered) popover.popdown()
      hideTimer = 0
      return GLib.SOURCE_REMOVE
    })
  }

  const motion = new Gtk.EventControllerMotion()
  motion.connect("enter", () => {
    anchorHovered = true
    cancelHide()
    popover.popup()
  })
  motion.connect("leave", () => {
    anchorHovered = false
    scheduleHide()
  })
  root.add_controller(motion)

  const popMotion = new Gtk.EventControllerMotion()
  popMotion.connect("enter", () => {
    popoverHovered = true
    cancelHide()
  })
  popMotion.connect("leave", () => {
    popoverHovered = false
    scheduleHide()
  })
  card.add_controller(popMotion)

  root.connect("realize", () => popover.set_parent(root))

  return root
}

function drawCpu(
  cr: any,
  cx: number,
  cy: number,
  r: number,
  g: number,
  b: number,
) {
  const body = 5,
    pin = 2,
    gap = 1.8
  cr.setSourceRGBA(r, g, b, 0.15)
  cr.rectangle(cx - body, cy - body, body * 2, body * 2)
  cr.fill()

  cr.setLineWidth(0.9)
  cr.setSourceRGBA(r, g, b, 0.7)
  cr.rectangle(cx - body, cy - body, body * 2, body * 2)
  cr.stroke()

  cr.setLineWidth(0.5)
  cr.setSourceRGBA(r, g, b, 0.25)
  cr.moveTo(cx, cy - body + 1)
  cr.lineTo(cx, cy + body - 1)
  cr.stroke()
  cr.moveTo(cx - body + 1, cy)
  cr.lineTo(cx + body - 1, cy)
  cr.stroke()

  cr.setLineWidth(1.0)
  cr.setSourceRGBA(r, g, b, 0.55)
  cr.setLineCap(1)
  for (let i = -1; i <= 1; i += 2) {
    const o = i * gap
    cr.moveTo(cx + o, cy - body)
    cr.lineTo(cx + o, cy - body - pin)
    cr.stroke()
    cr.moveTo(cx + o, cy + body)
    cr.lineTo(cx + o, cy + body + pin)
    cr.stroke()
    cr.moveTo(cx - body, cy + o)
    cr.lineTo(cx - body - pin, cy + o)
    cr.stroke()
    cr.moveTo(cx + body, cy + o)
    cr.lineTo(cx + body + pin, cy + o)
    cr.stroke()
  }
}

function drawRam(
  cr: any,
  cx: number,
  cy: number,
  r: number,
  g: number,
  b: number,
) {
  const W = 6,
    H = 11
  cr.setSourceRGBA(r, g, b, 0.15)
  cr.rectangle(cx - W / 2, cy - H / 2, W, H)
  cr.fill()

  cr.setLineWidth(0.9)
  cr.setSourceRGBA(r, g, b, 0.7)
  cr.rectangle(cx - W / 2, cy - H / 2, W, H)
  cr.stroke()

  cr.setSourceRGBA(r, g, b, 0.3)
  for (let i = -1; i <= 1; i++) {
    cr.rectangle(cx - 1.2, cy + i * 2.8 - 1.0, 2.4, 2.0)
    cr.fill()
  }

  cr.setSourceRGBA(r, g, b, 0.7)
  cr.setLineWidth(0.9)
  cr.moveTo(cx - W / 2, cy + H / 2)
  cr.lineTo(cx - 1, cy + H / 2)
  cr.moveTo(cx + 1, cy + H / 2)
  cr.lineTo(cx + W / 2, cy + H / 2)
  cr.stroke()
}

function drawSwap(
  cr: any,
  cx: number,
  cy: number,
  r: number,
  g: number,
  b: number,
) {
  cr.setSourceRGBA(r, g, b, 0.65)
  cr.setLineWidth(1.2)
  cr.setLineCap(1)

  cr.moveTo(cx - 2, cy - 1)
  cr.lineTo(cx - 2, cy - 5)
  cr.lineTo(cx - 4, cy - 3)
  cr.moveTo(cx - 2, cy - 5)
  cr.lineTo(cx, cy - 3)
  cr.stroke()

  cr.moveTo(cx + 2, cy + 1)
  cr.lineTo(cx + 2, cy + 5)
  cr.lineTo(cx, cy + 3)
  cr.moveTo(cx + 2, cy + 5)
  cr.lineTo(cx + 4, cy + 3)
  cr.stroke()
}

function statCol(
  label: string,
  valueKey: () => number,
  unit: string,
  hex: string,
): Gtk.Box {
  const col = new Gtk.Box()
  col.set_orientation(Gtk.Orientation.VERTICAL)
  col.set_spacing(4)
  col.set_halign(Gtk.Align.CENTER)
  col.add_css_class("sysmon-stat-col")

  const lbl = new Gtk.Label()
  lbl.add_css_class("sysmon-stat-label")
  lbl.set_label(label)

  const val = new Gtk.Label()
  val.add_css_class("sysmon-stat-value")

  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
    val.set_markup(`<span foreground="${hex}">${valueKey()}${unit}</span>`)
    return GLib.SOURCE_CONTINUE
  })

  col.append(val)
  col.append(lbl)
  return col
}
