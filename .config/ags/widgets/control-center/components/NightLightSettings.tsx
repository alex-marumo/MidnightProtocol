import { Gtk } from "ags/gtk4"
import GLib from "gi://GLib"
import { SliderRow } from "../utils/helpers"
import { nightRefs } from "../lib/nightlight"
import { launchHyprsunset, fetchLocation } from "../lib/nightlight"
import { saveState, loadState } from "../lib/persistence"

export function NightLightSettings() {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
  })
  box.add_css_class("cc-nightlight-cfg")

  let debounceId: number | null = null

  const { row: tempRow, scale: tempScale } = SliderRow(
    "✹",
    "cc-temp-icon",
    () => loadState().val,
    (v) => {
      if (debounceId !== null) {
        GLib.source_remove(debounceId)
        debounceId = null
      }
      debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
        saveState(nightRefs.isNightLightAuto, v)
        launchHyprsunset(v)
        debounceId = null
        return GLib.SOURCE_REMOVE
      })
    },
  )
  nightRefs.nightSlider = tempScale
  tempScale.set_range(0, 100)
  tempScale.set_value(loadState().val)

  const locLbl = new Gtk.Label()
  locLbl.add_css_class("ctrl-pop-detail")
  locLbl.set_halign(Gtk.Align.START)
  const s0 = loadState()
  locLbl.set_label(
    s0.lat != null
      ? `Location: ${s0.lat.toFixed(2)}, ${s0.lon.toFixed(2)}`
      : "Location: not detected",
  )

  const autoToggle = new Gtk.CheckButton({
    label: "Auto (sunset → sunrise)",
    active: nightRefs.isNightLightAuto,
  })
  autoToggle.connect("toggled", () => {
    nightRefs.isNightLightAuto = autoToggle.get_active()

    if (nightRefs.isNightLightAuto) {
      const val = tempScale.get_value()
      locLbl.set_label("Detecting location…")
      const existing = loadState()

      const launch = (lat: number, lon: number) => {
        saveState(true, val, lat, lon)
        launchHyprsunset(val, lat, lon)
        locLbl.set_label(`Location: ${lat.toFixed(2)}, ${lon.toFixed(2)}`)
        nightRefs.nightPill.lbl.set_label("Night (Auto)")
        nightRefs.nightPill.pill.add_css_class("cc-pill-auto")
      }

      if (existing.lat != null && existing.lon != null) {
        launch(existing.lat, existing.lon)
      } else {
        fetchLocation()
          .then(({ lat, lon }) => launch(lat, lon))
          .catch(() => {
            locLbl.set_label("Location failed — using always-on")
            saveState(true, val)
            launchHyprsunset(val)
          })
      }
    } else {
      saveState(false, tempScale.get_value())
      nightRefs.nightPill.lbl.set_label("Night Light")
      nightRefs.nightPill.pill.remove_css_class("cc-pill-auto")
      launchHyprsunset(tempScale.get_value())
    }
  })

  const refetchBtn = new Gtk.Button({ label: "Re-detect Location" })
  refetchBtn.add_css_class("ctrl-mini-btn")
  refetchBtn.connect("clicked", () => {
    locLbl.set_label("Detecting…")
    fetchLocation()
      .then(({ lat, lon }) => {
        locLbl.set_label(`Location: ${lat.toFixed(2)}, ${lon.toFixed(2)}`)
        if (nightRefs.isNightLightAuto)
          launchHyprsunset(tempScale.get_value(), lat, lon)
      })
      .catch(() => locLbl.set_label("Detection failed"))
  })

  const backBtn = new Gtk.Button({
    label: "← Back",
    halign: Gtk.Align.START,
    css_classes: ["cc-notif-clear"],
  })
  backBtn.connect("clicked", () =>
    nightRefs.bottomStack?.set_visible_child_name("tab-0"),
  )

  box.append(
    new Gtk.Label({
      label: "Night Light Settings",
      halign: Gtk.Align.START,
      css_classes: ["cc-notif-summary"],
    }),
  )
  box.append(tempRow)
  box.append(autoToggle)
  box.append(locLbl)
  box.append(refetchBtn)
  box.append(new Gtk.Separator())
  box.append(backBtn)

  return box
}
