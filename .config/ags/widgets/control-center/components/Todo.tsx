import { Gtk } from "ags/gtk4"
import Gio from "gi://Gio"
import GLib from "gi://GLib"

export function Todo() {
  const TODO_FILE = `${GLib.get_home_dir()}/.config/ags/todos.json`

  interface Task {
    text: string
    done: boolean
  }

  function loadTodos(): Task[] {
    try {
      const file = Gio.File.new_for_path(TODO_FILE)
      const [success, contents] = file.load_contents(null)
      const raw = JSON.parse(new TextDecoder().decode(contents))
      return raw.map((t: any) =>
        typeof t === "string" ? { text: t, done: false } : t,
      )
    } catch {
      return []
    }
  }

  function saveTodos(data: Task[]) {
    const file = Gio.File.new_for_path(TODO_FILE)
    const bytes = new TextEncoder().encode(JSON.stringify(data))
    file.replace_contents_async(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
      null,
    )
  }

  let tasks = loadTodos()
  const list = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
  })
  list.add_css_class("cc-todo-list")

  const render = () => {
    let child = list.get_first_child()
    while (child) {
      list.remove(child)
      child = list.get_first_child()
    }

    tasks.forEach((task, idx) => {
      const isDone = !!task.done
      const row = new Gtk.Box({ spacing: 6 })
      row.add_css_class("cc-todo-row")
      if (isDone) row.add_css_class("cc-todo-done")

      const check = new Gtk.CheckButton({ active: isDone })
      check.connect("toggled", () => {
        tasks[idx].done = check.get_active()
        saveTodos(tasks)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
          render()
          return false
        })
      })

      const lbl = new Gtk.Label({
        label: task.text || "Unnamed Task",
        hexpand: true,
        halign: Gtk.Align.START,
        ellipsize: 3,
      })
      lbl.add_css_class("cc-todo-lbl")

      const del = new Gtk.Button({
        child: new Gtk.Label({ label: "×" }),
        css_classes: ["cc-todo-del"],
      })
      del.connect("clicked", () => {
        tasks.splice(idx, 1)
        saveTodos(tasks)
        render()
      })

      row.append(check)
      row.append(lbl)
      row.append(del)
      list.append(row)
    })
  }

  const entry = new Gtk.Entry({
    placeholder_text: "Add task...",
    hexpand: true,
  })
  entry.add_css_class("cc-todo-entry")
  entry.connect("activate", () => {
    const val = entry.get_text().trim()
    if (!val) return
    tasks.push({ text: val, done: false })
    saveTodos(tasks)
    entry.set_text("")
    render()
  })

  const clearBtn = new Gtk.Button({
    label: "Clear Completed",
    css_classes: ["cc-todo-clear"],
    hexpand: true,
  })
  clearBtn.connect("clicked", () => {
    tasks = tasks.filter((t) => !t.done)
    saveTodos(tasks)
    render()
  })

  const scroll = new Gtk.ScrolledWindow({ vexpand: true, child: list })
  scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
  box.append(scroll)
  box.append(entry)
  box.append(clearBtn)

  render()
  return box
}
