#!/usr/bin/env python3
import gi
gi.require_version("Gtk", "4.0")
gi.require_version("Gtk4LayerShell", "1.0")
from gi.repository import Gtk, Gtk4LayerShell, GLib

def on_activate(app):
    win = Gtk.ApplicationWindow(application=app)
    win.set_decorated(False)

    # enable alpha/transparency support
    display = win.get_display()
    surface = win.get_surface() if hasattr(win, 'get_surface') else None

    Gtk4LayerShell.init_for_window(win)
    Gtk4LayerShell.set_layer(win, Gtk4LayerShell.Layer.BOTTOM)
    Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.BOTTOM, True)
    Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.RIGHT, True)
    Gtk4LayerShell.set_margin(win, Gtk4LayerShell.Edge.BOTTOM, 30)
    Gtk4LayerShell.set_margin(win, Gtk4LayerShell.Edge.RIGHT, 30)
    Gtk4LayerShell.set_exclusive_zone(win, -1)
    Gtk4LayerShell.set_namespace(win, "activate-linux")

    css = Gtk.CssProvider()
    css.load_from_string("""
        window, .background, decoration, decoration-overlay,
        windowhandle, box {
            background: transparent;
            background-color: transparent;
            box-shadow: none;
            border: none;
        }
        .al-title {
            font-family: "IosevkaTerm NF", "JetBrainsMono Nerd Font", monospace;
            font-size: 24px;
            font-weight: 700;
            color: rgba(255,255,255,0.72);
        }
        .al-sub {
            font-family: "IosevkaTerm NF", "JetBrainsMono Nerd Font", monospace;
            font-size: 14px;
            color: rgba(255,255,255,0.52);
        }
    """)
    Gtk.StyleContext.add_provider_for_display(
        win.get_display(), css, Gtk.STYLE_PROVIDER_PRIORITY_USER
    )

    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)

    title = Gtk.Label(label="Activate Linux")
    title.add_css_class("al-title")
    title.set_halign(Gtk.Align.START)

    sub = Gtk.Label(label="Go to Settings to activate Linux")
    sub.add_css_class("al-sub")
    sub.set_halign(Gtk.Align.START)

    box.append(title)
    box.append(sub)
    win.set_child(box)
    win.present()

app = Gtk.Application(application_id="com.alexm.activate-linux")
app.connect("activate", on_activate)
app.run()
