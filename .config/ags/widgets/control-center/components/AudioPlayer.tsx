import { Gtk } from "ags/gtk4"
import Mpris from "gi://AstalMpris"

export function AudioPlayer() {
  const mpris = Mpris.get_default()

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["cc-audio-container"],
    spacing: 6,
  })

  const getActivePlayer = () =>
    mpris.players.find(
      (p) => p.playback_status === Mpris.PlaybackStatus.PLAYING,
    ) || mpris.players[0]

  const clear = () => {
    let c = container.get_first_child()
    while (c) {
      container.remove(c)
      c = container.get_first_child()
    }
  }

  const update = () => {
    clear()

    const player = getActivePlayer()
    if (!player) {
      container.append(
        new Gtk.Label({
          label: "Idle",
          css_classes: ["cc-audio-artist"],
        }),
      )
      return
    }

    const row = new Gtk.Box({ spacing: 8 })

    const art = new Gtk.Image({
      pixel_size: 36,
      css_classes: ["cc-audio-art"],
    })

    if (player.art_url) {
      try {
        art.set_from_file(player.art_url.replace("file://", ""))
      } catch {}
    }

    const meta = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      hexpand: true,
      spacing: 0,
    })

    const title = new Gtk.Label({
      label: player.title || "Unknown",
      css_classes: ["cc-audio-title"],
      halign: Gtk.Align.START,
      ellipsize: 3,
      max_width_chars: 22,
    })

    const artist = new Gtk.Label({
      label: player.artist || "",
      css_classes: ["cc-audio-artist"],
      halign: Gtk.Align.START,
      ellipsize: 3,
      max_width_chars: 22,
    })

    player.connect("notify::title", () =>
      title.set_label(player.title || "Unknown"),
    )
    player.connect("notify::artist", () =>
      artist.set_label(player.artist || ""),
    )

    meta.append(title)
    meta.append(artist)

    const playBtn = new Gtk.Button({ css_classes: ["cc-audio-play-btn"] })

    const icon = new Gtk.Image()

    const syncIcon = () => {
      icon.icon_name =
        player.playback_status === Mpris.PlaybackStatus.PLAYING
          ? "media-playback-pause-symbolic"
          : "media-playback-start-symbolic"
    }

    syncIcon()
    player.connect("notify::playback-status", syncIcon)

    playBtn.set_child(icon)
    playBtn.connect("clicked", () => player.play_pause())

    row.append(art)
    row.append(meta)
    row.append(playBtn)

    container.append(row)

    const progress = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      draw_value: false,
      height_request: 4,
    })

    progress.set_range(0, player.length || 1)

    player.connect("notify::position", () =>
      progress.set_value(player.position || 0),
    )

    container.append(progress)
  }

  mpris.connect("notify::players", update)
  update()

  return container
}
