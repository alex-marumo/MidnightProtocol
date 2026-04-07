import { Gtk } from "ags/gtk4"

export function SliderRow(
  icon: string,
  iconCls: string,
  getValue: () => number,
  setValue: (v: number) => void,
) {
  const icn = new Gtk.Label()
  icn.add_css_class("cc-slider-icon")
  icn.add_css_class(iconCls)
  icn.set_label(icon)

  const scale = new Gtk.Scale()
  scale.set_orientation(Gtk.Orientation.HORIZONTAL)
  scale.set_range(0, 100)
  scale.set_increments(1, 5)
  scale.set_value(getValue())
  scale.set_hexpand(true)
  scale.set_draw_value(false)
  scale.add_css_class("cc-slider")

  const valLbl = new Gtk.Label()
  valLbl.add_css_class("cc-slider-val")
  valLbl.set_label(`${Math.round(getValue())}`)
  valLbl.set_width_chars(3)
  valLbl.set_xalign(1)

  let suppress = false

  scale.connect("value-changed", () => {
    if (suppress) return
    const v = Math.round(scale.get_value())
    valLbl.set_label(`${v}`)

    if (iconCls === "cc-vol-icon") {
      if (v === 0) icn.set_label("◌")
      else if (v < 30) icn.set_label("◔")
      else if (v < 70) icn.set_label("◑")
      else icn.set_label("◕")
    }

    if (iconCls === "cc-bri-icon") {
      if (v < 30) icn.set_label("☼")
      else if (v < 70) icn.set_label("✺")
      else icn.set_label("✹")
    }

    setValue(v)
  })

  const row = new Gtk.Box()
  row.set_orientation(Gtk.Orientation.HORIZONTAL)
  row.set_spacing(8)
  row.set_valign(Gtk.Align.CENTER)
  row.add_css_class("cc-slider-row")
  row.append(icn)
  row.append(scale)
  row.append(valLbl)

  const setValueSilent = (v: number) => {
    suppress = true
    scale.set_value(v)
    valLbl.set_label(`${v}`)
    suppress = false
  }

  return { row, scale, valLbl, setValueSilent }
}

export function PillToggle({
  icon,
  iconActive,
  label,
  active,
  onToggle,
  onLabelClick,
}: {
  icon: string
  iconActive: string
  label: string
  active: boolean
  onToggle: (v: boolean) => void
  onLabelClick: () => void
}) {
  let on = active

  const pill = new Gtk.Box()
  pill.set_orientation(Gtk.Orientation.HORIZONTAL)
  pill.add_css_class("cc-pill")
  if (on) pill.add_css_class("cc-pill-active")

  const iconBtn = new Gtk.Box()
  iconBtn.add_css_class("cc-pill-icon-btn")
  const icn = new Gtk.Label()
  icn.add_css_class("cc-pill-icon")
  icn.set_label(on ? iconActive : icon)
  iconBtn.append(icn)
  const iconClick = new Gtk.GestureClick()
  iconClick.connect("pressed", () => {
    on = !on
    icn.set_label(on ? iconActive : icon)
    if (on) pill.add_css_class("cc-pill-active")
    else pill.remove_css_class("cc-pill-active")
    onToggle(on)
  })
  iconBtn.add_controller(iconClick)

  const div = new Gtk.Separator()
  div.set_orientation(Gtk.Orientation.VERTICAL)
  div.add_css_class("cc-pill-div")

  const labelBtn = new Gtk.Box()
  labelBtn.add_css_class("cc-pill-label-btn")
  labelBtn.set_hexpand(true)
  const lbl = new Gtk.Label()
  lbl.add_css_class("cc-pill-label")
  lbl.set_label(label)
  lbl.set_ellipsize(3)
  lbl.set_max_width_chars(12)
  lbl.set_halign(Gtk.Align.START)
  labelBtn.append(lbl)
  const labelClick = new Gtk.GestureClick()
  labelClick.connect("pressed", onLabelClick)
  labelBtn.add_controller(labelClick)

  pill.append(iconBtn)
  pill.append(div)
  pill.append(labelBtn)

  return {
    pill,
    lbl,
    icn,
    setActive: (v: boolean) => {
      on = v
      icn.set_label(on ? iconActive : icon)
      if (on) pill.add_css_class("cc-pill-active")
      else pill.remove_css_class("cc-pill-active")
    },
  }
}
