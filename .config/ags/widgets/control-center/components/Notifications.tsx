import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"

interface NotifEntry {
  app: string
  summary: string
  body: string
  time: number
}

const notifHistory: NotifEntry[] = []
const notifListeners: Array<() => void> = []

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

// Start dbus monitor once
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

export function Notifications() {
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
