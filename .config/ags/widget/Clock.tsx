import { Gtk } from "ags/gtk4"
import { createState } from "ags"
import GLib from "gi://GLib"

const [time, setTime] = createState("")
const [date, setDate] = createState("")
const [secs, setSecs] = createState(0)

function tick() {
  const now = GLib.DateTime.new_now_local()
  setTime(`${now.format("%H")}\n${now.format("%M")}`)
  setDate(now.format("%d|%m") ?? "")
  setSecs(parseInt(now.format("%S") ?? "0"))
}

tick()
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
  tick()
  return GLib.SOURCE_CONTINUE
})

// ── Time progress helpers ─────────────────────────────────────
function getProgressData() {
  const now = GLib.DateTime.new_now_local()
  const h = now.get_hour()
  const m = now.get_minute()
  const s = now.get_second()
  const dow = now.get_day_of_week() // 1=Mon 7=Sun
  const dom = now.get_day_of_month()
  const doy = now.get_day_of_year()
  const month = now.get_month()
  const year = now.get_year()

  // days in current month
  const daysInMonth = GLib.DateTime.new_local(
    year,
    month + 1 > 12 ? 1 : month + 1,
    1,
    0,
    0,
    0,
  )
    .add_days(-1)
    .get_day_of_month()
  const daysInYear =
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365

  const dayPct = ((h * 3600 + m * 60 + s) / 86400) * 100
  const weekPct =
    (((dow - 1) * 86400 + h * 3600 + m * 60 + s) / (7 * 86400)) * 100
  const monthPct =
    (((dom - 1) * 86400 + h * 3600 + m * 60 + s) / (daysInMonth * 86400)) * 100
  const yearPct =
    (((doy - 1) * 86400 + h * 3600 + m * 60 + s) / (daysInYear * 86400)) * 100

  return {
    dayPct,
    dayLeft: 100 - dayPct,
    weekPct,
    weekLeft: 100 - weekPct,
    monthPct,
    monthLeft: 100 - monthPct,
    yearPct,
    yearLeft: 100 - yearPct,
    fullDate: now.format("%A, %d %B %Y") ?? "",
    fullTime: now.format("%H:%M:%S") ?? "",
  }
}

// ── Progress row ─────────────────────────────────────────────
function ProgressRow(label: string, pct: number) {
  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(3)
  box.add_css_class("clock-pop-row")

  const header = new Gtk.Box()
  header.set_orientation(Gtk.Orientation.HORIZONTAL)

  const lbl = new Gtk.Label()
  lbl.set_label(label)
  lbl.set_halign(Gtk.Align.START)
  lbl.set_hexpand(true)
  lbl.add_css_class("clock-pop-label")

  const pctLbl = new Gtk.Label()
  pctLbl.set_label(`${pct.toFixed(1)}%`)
  pctLbl.set_halign(Gtk.Align.END)
  pctLbl.add_css_class("clock-pop-pct")

  header.append(lbl)
  header.append(pctLbl)

  const track = new Gtk.Box()
  track.add_css_class("clock-pop-track")
  track.set_size_request(160, 3)

  const fill = new Gtk.Box()
  fill.add_css_class("clock-pop-fill")
  fill.set_size_request(Math.round(pct * 1.6), 3)
  track.append(fill)

  box.append(header)
  box.append(track)
  return { box, pctLbl, fill }
}

export default function Clock() {
  // ── popover ────────────────────────────────────────────────
  const popover = new Gtk.Popover()
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.RIGHT)
  popover.add_css_class("clock-popover")
  popover.set_autohide(true)

  const popBox = new Gtk.Box()
  popBox.set_orientation(Gtk.Orientation.VERTICAL)
  popBox.set_spacing(10)
  popBox.add_css_class("clock-pop-box")

  // full date + time header
  const dateLbl = new Gtk.Label()
  dateLbl.add_css_class("clock-pop-date")
  dateLbl.set_halign(Gtk.Align.START)

  const timeLbl = new Gtk.Label()
  timeLbl.add_css_class("clock-pop-time")
  timeLbl.set_halign(Gtk.Align.START)

  const sep = new Gtk.Separator()
  sep.set_orientation(Gtk.Orientation.HORIZONTAL)

  popBox.append(dateLbl)
  popBox.append(timeLbl)
  popBox.append(sep)

  // progress rows
  const d = getProgressData()
  const dayRow = ProgressRow("DAY", d.dayPct)
  const weekRow = ProgressRow("WEEK", d.weekPct)
  const monthRow = ProgressRow("MONTH", d.monthPct)
  const yearRow = ProgressRow("YEAR", d.yearPct)

  popBox.append(dayRow.box)
  popBox.append(weekRow.box)
  popBox.append(monthRow.box)
  popBox.append(yearRow.box)

  popover.set_child(popBox)

  // update popover every second when visible
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
    if (!popover.get_visible()) return GLib.SOURCE_CONTINUE
    const d = getProgressData()
    dateLbl.set_label(d.fullDate)
    timeLbl.set_label(d.fullTime)
    dayRow.pctLbl.set_label(`${d.dayPct.toFixed(1)}%`)
    weekRow.pctLbl.set_label(`${d.weekPct.toFixed(1)}%`)
    monthRow.pctLbl.set_label(`${d.monthPct.toFixed(1)}%`)
    yearRow.pctLbl.set_label(`${d.yearPct.toFixed(1)}%`)
    dayRow.fill.set_size_request(Math.round(d.dayPct * 1.6), 3)
    weekRow.fill.set_size_request(Math.round(d.weekPct * 1.6), 3)
    monthRow.fill.set_size_request(Math.round(d.monthPct * 1.6), 3)
    yearRow.fill.set_size_request(Math.round(d.yearPct * 1.6), 3)
    return GLib.SOURCE_CONTINUE
  })

  // ── root ──────────────────────────────────────────────────
  const root = (
    <box
      cssClasses={["clock-box"]}
      orientation={Gtk.Orientation.VERTICAL}
      halign={Gtk.Align.CENTER}
      spacing={3}
    >
      <label
        cssClasses={["clock"]}
        label={time}
        halign={Gtk.Align.CENTER}
        justify={Gtk.Justification.CENTER}
      />
      <label
        cssClasses={["clock-seconds"]}
        label={secs((s: number) => "─".repeat(Math.floor(s / 10)))}
        halign={Gtk.Align.CENTER}
      />
      <label cssClasses={["date"]} label={date} halign={Gtk.Align.CENTER} />
    </box>
  )

  root.connect("realize", () => {
    popover.set_parent(root)
    const d = getProgressData()
    dateLbl.set_label(d.fullDate)
    timeLbl.set_label(d.fullTime)
  })

  const click = new Gtk.GestureClick()
  click.connect("pressed", () => {
    if (popover.get_visible()) popover.popdown()
    else popover.popup()
  })
  root.add_controller(click)

  return root
}
