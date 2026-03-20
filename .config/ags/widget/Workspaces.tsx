import { Gtk } from "ags/gtk4"
import { createState } from "ags"

const Hyprland = (await import("gi://AstalHyprland")).default.get_default()

// Kanji workspace labels because why not (plain numbers are for the weak)
const kanji = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]

export default function Workspaces() {
  const [focusedId, setFocusedId] = createState(
    Hyprland.focusedWorkspace?.id ?? 1,
  )
  const [workspaceList, setWorkspaceList] = createState<any[]>(
    Hyprland.workspaces ?? [],
  )

  Hyprland.connect("notify::focused-workspace", () =>
    setFocusedId(Hyprland.focusedWorkspace?.id ?? 1),
  )
  Hyprland.connect("notify::workspaces", () =>
    setWorkspaceList([...(Hyprland.workspaces ?? [])]),
  )

  return (
    <box
      cssClasses={["workspaces"]}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={3}
      halign={Gtk.Align.CENTER}
    >
      {kanji.map((k, i) => {
        const id = i + 1

        return (
          <button
            cssClasses={focusedId((fid: number) => {
              const wl = workspaceList.get() as any[]
              const ws = wl.find((w) => w.id === id)
              const isOccupied = ws && ws.clients?.length > 0
              if (fid === id) return ["ws-btn", "active"]
              if (isOccupied) return ["ws-btn", "occupied"]
              return ["ws-btn"]
            })}
            halign={Gtk.Align.CENTER}
            onClicked={() => Hyprland.dispatch("workspace", `${id}`)}
          >
            <label label={k} />
          </button>
        )
      })}
    </box>
  )
}
