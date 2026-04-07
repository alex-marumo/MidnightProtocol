import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

export function Timer() {
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
