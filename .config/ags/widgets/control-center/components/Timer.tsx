import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"

export function Timer() {
  let seconds = 0
  let running = false
  let timerId = 0
  let mode: "timer" | "pomodoro" = "timer"
  let pomoPhase: "focus" | "break" | "idle" = "idle"
  let cycles = 0

  const POMO_FOCUS = 25 * 60
  const POMO_SHORT = 5 * 60
  const POMO_LONG = 15 * 60

  const display = new Gtk.Label()
  display.add_css_class("cc-timer-display")
  display.set_label("00:00")

  const statusLabel = new Gtk.Label()
  statusLabel.add_css_class("cc-timer-status")
  statusLabel.set_label("")

  const fmt = (s: number) => {
    const m = Math.floor(Math.abs(s) / 60)
      .toString()
      .padStart(2, "0")
    const sec = (Math.abs(s) % 60).toString().padStart(2, "0")
    return `${m}:${sec}`
  }

  const tick = () => {
    seconds--
    display.set_label(fmt(seconds))

    if (seconds <= 0) {
      seconds = 0
      running = false
      if (timerId) {
        GLib.source_remove(timerId)
        timerId = 0
      }

      // Pomodoro auto-cycle
      if (mode === "pomodoro") {
        if (pomoPhase === "focus") {
          cycles++
          cycleLabel.set_label(`cycles: ${cycles}`)
          const isLongBreak = cycles % 4 === 0
          pomoPhase = "break"
          seconds = isLongBreak ? POMO_LONG : POMO_SHORT
          statusLabel.set_label(isLongBreak ? "[ long break ]" : "[ break ]")
          running = true
          display.set_label(fmt(seconds))
          timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, tick)
        } else {
          pomoPhase = "idle"
          statusLabel.set_label("[ standby ]")
          display.set_label(fmt(POMO_FOCUS))
        }
      } else {
        statusLabel.set_label("")
      }
    }

    return running ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE
  }

  // Timer mode controls
  const hourEntry = new Gtk.Entry()
  hourEntry.add_css_class("cc-timer-entry")
  hourEntry.set_placeholder_text("h")
  hourEntry.set_width_chars(2)
  hourEntry.set_max_width_chars(2)
  hourEntry.set_text("00")

  const minEntry = new Gtk.Entry()
  minEntry.add_css_class("cc-timer-entry")
  minEntry.set_placeholder_text("m")
  minEntry.set_width_chars(2)
  minEntry.set_max_width_chars(2)
  minEntry.set_text("00")

  const secEntry = new Gtk.Entry()
  secEntry.add_css_class("cc-timer-entry")
  secEntry.set_placeholder_text("s")
  secEntry.set_width_chars(2)
  secEntry.set_max_width_chars(2)
  secEntry.set_text("00")

  const timerInputBox = new Gtk.Box()
  timerInputBox.set_orientation(Gtk.Orientation.HORIZONTAL)
  timerInputBox.set_spacing(4)
  timerInputBox.set_halign(Gtk.Align.CENTER)
  timerInputBox.append(hourEntry)
  const colon1 = new Gtk.Label()
  colon1.set_label(":")
  colon1.add_css_class("cc-timer-colon")
  timerInputBox.append(colon1)
  timerInputBox.append(minEntry)
  const colon2 = new Gtk.Label()
  colon2.set_label(":")
  colon2.add_css_class("cc-timer-colon")
  timerInputBox.append(colon2)
  timerInputBox.append(secEntry)

  // Pomodoro controls
  const pomoFocusEntry = new Gtk.Entry()
  pomoFocusEntry.add_css_class("cc-timer-entry")
  pomoFocusEntry.set_placeholder_text("focus")
  pomoFocusEntry.set_width_chars(5)
  pomoFocusEntry.set_max_width_chars(5)
  pomoFocusEntry.set_text("25")

  const pomoBreakEntry = new Gtk.Entry()
  pomoBreakEntry.add_css_class("cc-timer-entry")
  pomoBreakEntry.set_placeholder_text("break")
  pomoBreakEntry.set_width_chars(5)
  pomoBreakEntry.set_max_width_chars(5)
  pomoBreakEntry.set_text("5")

  const pomoLongEntry = new Gtk.Entry()
  pomoLongEntry.add_css_class("cc-timer-entry")
  pomoLongEntry.set_placeholder_text("long")
  pomoLongEntry.set_width_chars(5)
  pomoLongEntry.set_max_width_chars(5)
  pomoLongEntry.set_text("15")

  const pomoInputBox = new Gtk.Box()
  pomoInputBox.set_orientation(Gtk.Orientation.HORIZONTAL)
  pomoInputBox.set_spacing(6)
  pomoInputBox.set_halign(Gtk.Align.CENTER)
  pomoInputBox.append(pomoFocusEntry)
  pomoInputBox.append(pomoBreakEntry)
  pomoInputBox.append(pomoLongEntry)

  const cycleLabel = new Gtk.Label()
  cycleLabel.add_css_class("cc-timer-cycles")
  cycleLabel.set_label("cycles: 0")

  const pomoBox = new Gtk.Box()
  pomoBox.set_orientation(Gtk.Orientation.VERTICAL)
  pomoBox.set_spacing(6)
  pomoBox.set_halign(Gtk.Align.CENTER)
  pomoBox.append(pomoInputBox)
  pomoBox.append(cycleLabel)

  // Stack to switch between timer/pomo inputs
  const inputStack = new Gtk.Stack()
  inputStack.add_named(timerInputBox, "timer")
  inputStack.add_named(pomoBox, "pomodoro")
  inputStack.set_visible_child_name("timer")

  // Buttons
  const startBtn = new Gtk.Button()
  startBtn.add_css_class("cc-timer-btn")
  const startLbl = new Gtk.Label()
  startLbl.set_label("start")
  startBtn.set_child(startLbl)

  const resetBtn = new Gtk.Button()
  resetBtn.add_css_class("cc-timer-btn")
  const resetLbl = new Gtk.Label()
  resetLbl.set_label("reset")
  resetBtn.set_child(resetLbl)

  const modeBtn = new Gtk.Button()
  modeBtn.add_css_class("cc-timer-btn")
  const modeLbl = new Gtk.Label()
  modeLbl.set_label("mode: timer")
  modeBtn.set_child(modeLbl)

  startBtn.connect("clicked", () => {
    if (running) {
      running = false
      if (timerId) {
        GLib.source_remove(timerId)
        timerId = 0
      }
      startLbl.set_label("resume")
      statusLabel.set_label(mode === "pomodoro" ? "[ paused ]" : "")
      return
    }

    if (seconds === 0) {
      // Start new session
      if (mode === "timer") {
        const h = parseInt(hourEntry.get_text()) || 0
        const m = parseInt(minEntry.get_text()) || 0
        const s = parseInt(secEntry.get_text()) || 0
        seconds = h * 3600 + m * 60 + s
        if (seconds === 0) return
      } else {
        // Pomodoro
        const focusMins = parseInt(pomoFocusEntry.get_text()) || 25
        seconds = focusMins * 60
        pomoPhase = "focus"
        statusLabel.set_label("[ focus ]")
      }
    }

    running = true
    startLbl.set_label("pause")
    display.set_label(fmt(seconds))
    timerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, tick)
  })

  resetBtn.connect("clicked", () => {
    running = false
    if (timerId) {
      GLib.source_remove(timerId)
      timerId = 0
    }
    seconds = 0
    pomoPhase = "idle"
    cycles = 0
    display.set_label("00:00")
    startLbl.set_label("start")
    statusLabel.set_label("")
    cycleLabel.set_label("cycles: 0")
  })

  modeBtn.connect("clicked", () => {
    if (running) return // Don't switch modes while running

    mode = mode === "timer" ? "pomodoro" : "timer"
    modeLbl.set_label(`mode: ${mode}`)
    inputStack.set_visible_child_name(mode)
    seconds = 0
    display.set_label("00:00")
    statusLabel.set_label("")
    cycleLabel.set_label("cycles: 0")
    pomoPhase = "idle"
    cycles = 0
  })

  const controls = new Gtk.Box()
  controls.set_orientation(Gtk.Orientation.HORIZONTAL)
  controls.set_spacing(8)
  controls.set_halign(Gtk.Align.CENTER)
  controls.append(startBtn)
  controls.append(resetBtn)
  controls.append(modeBtn)

  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(10)
  box.set_halign(Gtk.Align.CENTER)
  box.add_css_class("cc-timer")
  box.append(statusLabel)
  box.append(display)
  box.append(inputStack)
  box.append(controls)

  return box
}
