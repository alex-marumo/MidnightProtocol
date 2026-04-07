import Cairo from "cairo"
import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function roundedRect(
  cr: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  r = Math.min(r, w / 2, h / 2)
  cr.newPath()
  cr.moveTo(x + r, y)
  cr.lineTo(x + w - r, y)
  cr.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  cr.lineTo(x + w, y + h - r)
  cr.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  cr.lineTo(x + r, y + h)
  cr.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  cr.lineTo(x, y + r)
  cr.arc(x + r, y + r, r, Math.PI, -Math.PI / 2)
  cr.closePath()
}

export default function Battery() {
  let pct = 0
  let charging = false

  const W = 18,
    H = 8,
    TW = 2,
    TH = 4,
    R = 1.5
  const CW = W + TW

  const da = new Gtk.DrawingArea()
  da.set_size_request(CW, H)

  const pctLbl = new Gtk.Label({
    cssClasses: ["battery-pct"],
    halign: Gtk.Align.CENTER,
    label: "0%",
  })

  let shimmerX = 0
  let pulseAlpha = 1
  let shimmerId: number | null = null
  let pulseId: number | null = null

  da.set_draw_func((_da, cr) => {
    const p = pct / 100
    let [fr, fg, fb] = hexToRgb("#a6e3a1")

    if (charging) [fr, fg, fb] = hexToRgb("#89b4fa")
    else if (p <= 0.15) [fr, fg, fb] = hexToRgb("#f38ba8")
    else if (p <= 0.3) [fr, fg, fb] = hexToRgb("#fab387")

    const ty = (H - TH) / 2

    // tip
    roundedRect(cr, W - 0.5, ty, TW + 0.5, TH, 1.2)
    cr.setSourceRGBA(1, 1, 1, 0.22)
    cr.fill()

    // border
    roundedRect(cr, 0.5, 0.5, W - 1, H - 1, R)
    cr.setSourceRGBA(1, 1, 1, 0.06)
    cr.fillPreserve()
    cr.setSourceRGBA(
      charging ? fr : 1,
      charging ? fg : 1,
      charging ? fb : 1,
      charging ? 0.7 : 0.18,
    )
    cr.setLineWidth(charging ? 1.2 : 1)
    cr.stroke()

    // fill
    const PAD = 2.2
    const fillW = Math.max(0, (W - PAD * 2) * p)
    const alpha = p <= 0.15 && !charging ? pulseAlpha : 0.95

    if (fillW > 0) {
      roundedRect(cr, PAD, PAD, fillW, H - PAD * 2, R - 1)

      const grad = new Cairo.LinearGradient(0, 0, 0, H)
      grad.addColorStopRGBA(
        0,
        Math.min(fr * 1.15, 1),
        Math.min(fg * 1.15, 1),
        Math.min(fb * 1.15, 1),
        alpha,
      )
      grad.addColorStopRGBA(1, fr * 0.82, fg * 0.82, fb * 0.82, alpha)
      cr.setSource(grad)
      cr.fill()

      // shimmer when charging
      if (charging) {
        const sx = PAD + shimmerX * fillW
        const sweep = new Cairo.LinearGradient(sx - 4, 0, sx + 4, 0)
        sweep.addColorStopRGBA(0, 1, 1, 1, 0)
        sweep.addColorStopRGBA(0.5, 1, 1, 1, 0.35)
        sweep.addColorStopRGBA(1, 1, 1, 1, 0)
        cr.setSource(sweep)
        roundedRect(cr, PAD, PAD, fillW, H - PAD * 2, R - 1)
        cr.fill()
      }
    }

    // shine
    roundedRect(cr, 1.5, 1.5, W - 3, (H - 3) / 2, R - 1)
    const shine = new Cairo.LinearGradient(0, 0, 0, H)
    shine.addColorStopRGBA(0, 1, 1, 1, 0.12)
    shine.addColorStopRGBA(1, 1, 1, 1, 0)
    cr.setSource(shine)
    cr.fill()

    // lightning bolt
    if (charging) {
      const cx = W / 2,
        cy = H / 2
      cr.newPath()
      cr.moveTo(cx + 2.5, cy - 3.5)
      cr.lineTo(cx - 1.5, cy + 0.5)
      cr.lineTo(cx + 0.5, cy + 0.5)
      cr.lineTo(cx - 2.5, cy + 3.5)
      cr.lineTo(cx + 1.5, cy - 0.5)
      cr.lineTo(cx - 0.5, cy - 0.5)
      cr.closePath()

      cr.setSourceRGBA(0, 0, 0, 0.5)
      cr.setLineWidth(1.2)
      cr.strokePreserve()
      cr.setSourceRGBA(1, 0.95, 0.3, 1)
      cr.fill()
    }
  })

  function startShimmer() {
    if (shimmerId) return
    shimmerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30, () => {
      if (!charging) {
        shimmerId = null
        shimmerX = 0
        return GLib.SOURCE_REMOVE
      }
      shimmerX = (shimmerX + 0.04) % 1.2
      da.queue_draw()
      return GLib.SOURCE_CONTINUE
    })
  }

  // low battery pulse (only when needed)
  pulseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
    if (pct <= 15 && !charging) {
      pulseAlpha = 0.45 + Math.abs(Math.sin(Date.now() / 120)) * 0.55
      da.queue_draw()
    }
    return GLib.SOURCE_CONTINUE
  })

  // Battery service
  ;(async () => {
    const bat = (await import("gi://AstalBattery")).default.get_default()

    const update = () => {
      pct = Math.round(bat.percentage * 100)
      charging = bat.charging
      pctLbl.set_label(`${pct}%`)
      if (charging) startShimmer()
      da.queue_draw()
    }

    update()
    bat.connect("notify::percentage", update)
    bat.connect("notify::charging", update)
  })()

  return (
    <box
      cssClasses={["battery-container"]}
      orientation={Gtk.Orientation.VERTICAL}
      halign={Gtk.Align.CENTER}
      spacing={3}
    >
      {da}
      {pctLbl}
    </box>
  )
}
