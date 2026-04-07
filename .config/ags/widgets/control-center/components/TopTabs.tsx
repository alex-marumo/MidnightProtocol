import { Gtk } from "ags/gtk4"
import { AudioPlayer } from "./AudioPlayer"
import { Notifications } from "./Notifications"

export function TopTabs() {
  const tabs = ["Audio", "Notifications"]
  const contents = [AudioPlayer(), Notifications()]
  let active = 0

  const tabBar = new Gtk.Box()
  tabBar.set_orientation(Gtk.Orientation.HORIZONTAL)
  tabBar.set_spacing(0)
  tabBar.add_css_class("cc-tab-bar")

  const stack = new Gtk.Stack()
  stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
  stack.set_transition_duration(150)

  contents.forEach((w, i) => stack.add_named(w, `top-tab-${i}`))
  stack.set_visible_child_name("top-tab-0")

  const btns = tabs.map((t, i) => {
    const btn = new Gtk.Button()
    btn.add_css_class("cc-tab-btn")
    if (i === 0) btn.add_css_class("cc-tab-active")

    const lbl = new Gtk.Label()
    lbl.set_label(t)
    btn.set_child(lbl)

    btn.connect("clicked", () => {
      btns[active].remove_css_class("cc-tab-active")
      active = i
      btn.add_css_class("cc-tab-active")
      stack.set_visible_child_name(`top-tab-${i}`)
    })

    tabBar.append(btn)
    return btn
  })

  const box = new Gtk.Box()
  box.set_orientation(Gtk.Orientation.VERTICAL)
  box.set_spacing(0)
  box.append(tabBar)
  box.append(stack)

  return box
}
