import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { execAsync } from "ags/process"

export function UptimeBar() {
  const uptimeLbl = new Gtk.Label()
  uptimeLbl.add_css_class("cc-uptime")
  uptimeLbl.set_halign(Gtk.Align.START)
  uptimeLbl.set_hexpand(true)

  const refresh = () =>
    execAsync(["bash", "-c", "uptime -p | sed 's/up //'"])
      .then((s: string) => uptimeLbl.set_label(s.trim()))
      .catch(() => {})
  refresh()
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
    refresh()
    return GLib.SOURCE_CONTINUE
  })

  const mkPill = (icon: string, label: string, cb: () => void) => {
    const pill = new Gtk.Box()
    pill.set_orientation(Gtk.Orientation.HORIZONTAL)
    pill.set_spacing(4)
    pill.add_css_class("cc-hdr-pill")
    const icn = new Gtk.Label()
    icn.add_css_class("cc-hdr-pill-icon")
    icn.set_label(icon)
    const lbl = new Gtk.Label()
    lbl.add_css_class("cc-hdr-pill-label")
    lbl.set_label(label)
    pill.append(icn)
    pill.append(lbl)
    const click = new Gtk.GestureClick()
    click.connect("pressed", () => cb())
    pill.add_controller(click)
    return pill
  }

  const settingsBtn = mkPill("󰒓", "CONFIG", () =>
    execAsync(["bash", "-c", "foot -e nvim ~/.config/ags/app.ts"]).catch(
      () => {},
    ),
  )

  const reloadBtn = mkPill("󰑓", "RELOAD", () =>
    execAsync([
      "bash",
      "-c",
      "nohup bash -c 'sleep 0.2 && ags run --gtk 4' &>/dev/null & ags quit",
    ]).catch(() => {}),
  )

  const powerBtn = mkPill("󰐥", "POWER", () =>
    execAsync([
      "bash",
      "-c",
      "wlogout -C ~/.config/wlogout/style.css -b 3 -c 10 -r 10 -m 300",
    ]).catch(() => {}),
  )

  const dndPill = new Gtk.Box()
  dndPill.set_orientation(Gtk.Orientation.HORIZONTAL)
  dndPill.set_spacing(4)
  dndPill.add_css_class("cc-hdr-pill")

  const dndIcon = new Gtk.Label()
  dndIcon.add_css_class("cc-hdr-pill-icon")
  dndIcon.set_label("󰂚")
  const dndState = new Gtk.Label()
  dndState.add_css_class("cc-hdr-pill-label")
  dndState.set_label("DND")
  dndPill.append(dndIcon)
  dndPill.append(dndState)

  const refreshDnd = () =>
    execAsync(["swaync-client", "--get-dnd"])
      .then((s: string) => {
        const on = s.trim() === "true"
        dndIcon.set_label(on ? "󰂛" : "󰂚")
        if (on) dndPill.add_css_class("cc-hdr-pill-active")
        else dndPill.remove_css_class("cc-hdr-pill-active")
      })
      .catch(() => {})

  refreshDnd()
  const dndClick = new Gtk.GestureClick()
  dndClick.connect("pressed", () =>
    execAsync(["swaync-client", "--toggle-dnd"])
      .then(refreshDnd)
      .catch(() => {}),
  )
  dndPill.add_controller(dndClick)

  const row = new Gtk.Box()
  row.set_orientation(Gtk.Orientation.HORIZONTAL)
  row.set_spacing(6)
  row.add_css_class("cc-uptime-row")
  row.append(uptimeLbl)
  row.append(settingsBtn)
  row.append(dndPill)
  row.append(reloadBtn)
  row.append(powerBtn)
  return row
}
