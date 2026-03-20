import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"

export default function Logo() {
  return (
    <button
      cssClasses={["logo-btn"]}
      halign={Gtk.Align.CENTER}
      onClicked={() => execAsync(["fuzzel", "-show", "drun"])}
    >
      <label cssClasses={["logo"]} label="鬼" halign={Gtk.Align.CENTER} />
    </button>
  )
}
