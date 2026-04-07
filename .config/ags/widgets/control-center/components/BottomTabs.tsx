import { Gtk } from "ags/gtk4"
import { Calendar } from "./Calendar"
import { Todo } from "./Todo"
import { Timer } from "./Timer"
import { NightLightSettings } from "./NightLightSettings"
import { nightRefs } from "../lib/nightlight"

export function BottomTabs() {
  const tabs = ["☷ Calendar", "☑ To Do", "⏱ Timer"]
  const contents = [Calendar(), Todo(), Timer(), NightLightSettings()]
  let active = 0

  const tabBar = new Gtk.Box()
  tabBar.set_orientation(Gtk.Orientation.HORIZONTAL)
  tabBar.set_spacing(0)
  tabBar.add_css_class("cc-tab-bar")

  const stack = new Gtk.Stack()
  stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  stack.set_transition_duration(150)
  stack.set_vexpand(true)

  contents.forEach((w, i) => {
    const name = i === 3 ? "tab-nightlight" : `tab-${i}`
    stack.add_named(w, name)
  })

  nightRefs.bottomStack = stack

  const btns = tabs.map((t, i) => {
    const btn = new Gtk.Button()
    btn.add_css_class("cc-tab-btn")
    if (i === 0) btn.add_css_class("cc-tab-active")

    const lbl = new Gtk.Label()
    lbl.set_label(t)
    btn.set_child(lbl)

    btn.connect("clicked", () => {
      btns[active]?.remove_css_class("cc-tab-active")
      active = i
      btn.add_css_class("cc-tab-active")
      stack.set_visible_child_name(`tab-${i}`)
    })

    tabBar.append(btn)
    return btn
  })

  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(0)
  box.set_vexpand(true)
  box.append(tabBar)
  box.append(stack)

  return box
}
