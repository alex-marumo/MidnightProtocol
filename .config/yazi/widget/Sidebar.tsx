import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import Logo from "./Logo"
import Workspaces from "./Workspaces"
import SysMon from "./SysMon"
import Media from "./Media"
import Clock from "./Clock"
import Battery from "./Battery"
import Controls from "./Controls"

export default function Sidebar(monitor: Gdk.Monitor) {
  return (
    <window
      name="sidebar"
      visible
      layer={Astal.Layer.TOP}
      anchor={
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.BOTTOM
      }
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      application={app}
      gdkmonitor={monitor}
      cssClasses={["sidebar-window"]}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        cssClasses={["sidebar"]}
        spacing={3}
        valign={Gtk.Align.FILL}
      >
        {/* ── Logo ── */}
        <box cssClasses={["pill"]} halign={Gtk.Align.CENTER}>
          <Logo />
        </box>

        {/* ── Center: SysMon + Workspaces ── */}
        <box
          cssClasses={["pill", "pill-center"]}
          orientation={Gtk.Orientation.VERTICAL}
          halign={Gtk.Align.CENTER}
          vexpand
          valign={Gtk.Align.CENTER}
          spacing={8}
        >
          <SysMon />
          <box cssClasses={["separator-line"]} />
          <Workspaces />
        </box>

        {/* ── Media ── */}
        <box cssClasses={["pill"]} halign={Gtk.Align.CENTER}>
          <Media />
        </box>

        {/* ── Clock + Battery ── */}
        <box
          cssClasses={["pill"]}
          orientation={Gtk.Orientation.VERTICAL}
          halign={Gtk.Align.CENTER}
          spacing={6}
        >
          <Clock />
          <box cssClasses={["separator-line"]} />
          <Battery />
        </box>

        {/* ── Controls ── */}
        <box
          cssClasses={["pill"]}
          orientation={Gtk.Orientation.VERTICAL}
          halign={Gtk.Align.CENTER}
          spacing={2}
        >
          <Controls />
        </box>
      </box>
    </window>
  )
}
