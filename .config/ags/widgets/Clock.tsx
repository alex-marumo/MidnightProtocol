import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

export default function Clock() {
  const timeLbl = new Gtk.Label({
    cssClasses: ["clock"],
    halign: Gtk.Align.CENTER,
    justify: Gtk.Justification.CENTER,
  })

  const secsLbl = new Gtk.Label({
    cssClasses: ["clock-seconds"],
    halign: Gtk.Align.CENTER,
  })

  const dateLbl = new Gtk.Label({
    cssClasses: ["date"],
    halign: Gtk.Align.CENTER,
  })

  let popoverVisible = false

  const popover = new Gtk.Popover({
    hasArrow: false,
    position: Gtk.PositionType.RIGHT,
    cssClasses: ["clock-popover"],
    autohide: true,
  })

  const popBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 10,
    cssClasses: ["clock-pop-box"],
  })

  const fullDate = new Gtk.Label({
    cssClasses: ["clock-pop-date"],
    halign: Gtk.Align.START,
  })
  const fullTime = new Gtk.Label({
    cssClasses: ["clock-pop-time"],
    halign: Gtk.Align.START,
  })

  function createProgressRow(label: string) {
    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 3,
      cssClasses: ["clock-pop-row"],
    })

    const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })

    const lbl = new Gtk.Label({
      label,
      halign: Gtk.Align.START,
      hexpand: true,
      cssClasses: ["clock-pop-label"],
    })

    const pctLbl = new Gtk.Label({
      label: "0%",
      halign: Gtk.Align.END,
      cssClasses: ["clock-pop-pct"],
    })

    header.append(lbl)
    header.append(pctLbl)

    const track = new Gtk.Box({
      cssClasses: ["clock-pop-track"],
    })
    track.set_size_request(160, 3)

    const fill = new Gtk.Box({ cssClasses: ["clock-pop-fill"] })

    track.append(fill)
    box.append(header)
    box.append(track)

    return { box, pctLbl, fill }
  }

  const dayRow = createProgressRow("DAY")
  const weekRow = createProgressRow("WEEK")
  const monthRow = createProgressRow("MONTH")
  const yearRow = createProgressRow("YEAR")

  popBox.append(fullDate)
  popBox.append(fullTime)
  popBox.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }))
  popBox.append(dayRow.box)
  popBox.append(weekRow.box)
  popBox.append(monthRow.box)
  popBox.append(yearRow.box)

  popover.set_child(popBox)

  function updateMain() {
    const now = GLib.DateTime.new_now_local()
    timeLbl.set_label(`${now.format("%H")}\n${now.format("%M")}`)
    secsLbl.set_label(
      "─".repeat(Math.floor(parseInt(now.format("%S") ?? "0") / 10)),
    )
    dateLbl.set_label(now.format("%d|%m") ?? "")
  }

  function updatePopover() {
    if (!popoverVisible) return

    const now = GLib.DateTime.new_now_local()
    const h = now.get_hour(),
      m = now.get_minute(),
      s = now.get_second()
    const dow = now.get_day_of_week()
    const dom = now.get_day_of_month()
    const doy = now.get_day_of_year()
    const month = now.get_month()
    const year = now.get_year()

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
      (((dom - 1) * 86400 + h * 3600 + m * 60 + s) / (daysInMonth * 86400)) *
      100
    const yearPct =
      (((doy - 1) * 86400 + h * 3600 + m * 60 + s) / (daysInYear * 86400)) * 100

    fullDate.set_label(now.format("%A, %d %B %Y") ?? "")
    fullTime.set_label(now.format("%H:%M:%S") ?? "")

    dayRow.pctLbl.set_label(`${dayPct.toFixed(1)}%`)
    weekRow.pctLbl.set_label(`${weekPct.toFixed(1)}%`)
    monthRow.pctLbl.set_label(`${monthPct.toFixed(1)}%`)
    yearRow.pctLbl.set_label(`${yearPct.toFixed(1)}%`)

    dayRow.fill.set_size_request(Math.round(dayPct * 1.6), 3)
    weekRow.fill.set_size_request(Math.round(weekPct * 1.6), 3)
    monthRow.fill.set_size_request(Math.round(monthPct * 1.6), 3)
    yearRow.fill.set_size_request(Math.round(yearPct * 1.6), 3)
  }

  // Single efficient tick
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
    updateMain()
    updatePopover()
    return GLib.SOURCE_CONTINUE
  })

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 3,
    cssClasses: ["clock-box"],
    halign: Gtk.Align.CENTER,
  })

  root.append(timeLbl)
  root.append(secsLbl)
  root.append(dateLbl)

  root.connect("realize", () => {
    popover.set_parent(root)
    updateMain()
    updatePopover()
  })

  const click = new Gtk.GestureClick()
  click.connect("pressed", () => {
    popoverVisible = !popoverVisible
    if (popoverVisible) popover.popup()
    else popover.popdown()
  })
  root.add_controller(click)

  popover.connect("closed", () => {
    popoverVisible = false
  })

  return root
}
