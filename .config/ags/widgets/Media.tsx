import { Gtk } from "ags/gtk4"
import { createState } from "ags"
import GLib from "gi://GLib"
import GdkPixbuf from "gi://GdkPixbuf"

const MprisModule = await import("gi://AstalMpris")
const MprisClass = MprisModule.default
const Mpris = MprisClass.get_default()
const GdkPixbuf = (await import("gi://GdkPixbuf")).default

const PR = 0.792,
  PG = 0.651,
  PB = 0.968
const BR = 0.537,
  BG = 0.706,
  BB = 0.98

// ── Cairo ─────────────────────────────────────────────────────
function drawNote(cr: any, cx: number, cy: number) {
  cr.setSourceRGBA(PR, PG, PB, 0.6)
  cr.setLineWidth(1.4)
  cr.setLineCap(1)
  cr.save()
  cr.translate(cx - 2.5, cy + 2.5)
  cr.scale(2.2, 1.6)
  cr.arc(0, 0, 1, 0, 2 * Math.PI)
  cr.restore()
  cr.fill()
  cr.setSourceRGBA(PR, PG, PB, 0.6)
  cr.moveTo(cx - 0.4, cy + 2.5)
  cr.lineTo(cx - 0.4, cy - 5)
  cr.stroke()
  cr.moveTo(cx - 0.4, cy - 5)
  cr.curveTo(cx + 5, cy - 3.5, cx + 5, cy - 0.5, cx + 1.5, cy + 0.5)
  cr.stroke()
}

function drawPlay(cr: any, cx: number, cy: number) {
  cr.setSourceRGBA(PR, PG, PB, 0.95)
  cr.newPath()
  cr.moveTo(cx - 4, cy - 5)
  cr.lineTo(cx - 4, cy + 5)
  cr.lineTo(cx + 5, cy)
  cr.closePath()
  cr.fill()
}

function drawPause(cr: any, cx: number, cy: number) {
  cr.setSourceRGBA(PR, PG, PB, 0.95)
  cr.setLineWidth(3)
  cr.setLineCap(1)
  cr.moveTo(cx - 3, cy - 5)
  cr.lineTo(cx - 3, cy + 5)
  cr.stroke()
  cr.moveTo(cx + 3, cy - 5)
  cr.lineTo(cx + 3, cy + 5)
  cr.stroke()
}

function drawPrev(cr: any, cx: number, cy: number) {
  cr.setSourceRGBA(BR, BG, BB, 0.8)
  cr.setLineWidth(1.8)
  cr.setLineCap(1)
  cr.moveTo(cx - 4, cy - 4)
  cr.lineTo(cx - 4, cy + 4)
  cr.stroke()
  cr.newPath()
  cr.moveTo(cx + 4, cy - 4)
  cr.lineTo(cx + 4, cy + 4)
  cr.lineTo(cx - 2, cy)
  cr.closePath()
  cr.fill()
}

function drawNext(cr: any, cx: number, cy: number) {
  cr.setSourceRGBA(BR, BG, BB, 0.8)
  cr.setLineWidth(1.8)
  cr.setLineCap(1)
  cr.moveTo(cx + 4, cy - 4)
  cr.lineTo(cx + 4, cy + 4)
  cr.stroke()
  cr.newPath()
  cr.moveTo(cx - 4, cy - 4)
  cr.lineTo(cx - 4, cy + 4)
  cr.lineTo(cx + 2, cy)
  cr.closePath()
  cr.fill()
}

function cairoBtn(
  size: number,
  draw: (cr: any) => void,
  cls: string,
  onClick: () => void,
) {
  const da = new Gtk.DrawingArea()
  da.set_size_request(size, size)
  da.set_draw_func((_w, cr) => draw(cr))
  const btn = new Gtk.Button()
  btn.add_css_class(cls)
  btn.set_child(da)
  btn.connect("clicked", onClick)
  return btn
}

// ── Bars ──────────────────────────────────────────────────────
function makeBar(phase0: number) {
  const da = new Gtk.DrawingArea()
  da.set_size_request(4, 20)
  let phase = phase0,
    active = false
  const start = () => {
    if (active) return
    active = true
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
      if (!active) return GLib.SOURCE_REMOVE
      phase += 0.38
      da.queue_draw()
      return GLib.SOURCE_CONTINUE
    })
  }
  const stop = () => {
    active = false
    da.queue_draw()
  }
  da.set_draw_func((_w, cr) => {
    const h = active ? 4 + Math.abs(Math.sin(phase)) * 14 : 2
    cr.setSourceRGBA(PR, PG, PB, 0.8)
    cr.rectangle(0, (20 - h) / 2, 4, h)
    cr.fill()
  })
  return { da, start, stop }
}

// ── Player binding ────────────────────────────────────────────

// ── Main ──────────────────────────────────────────────────────
export default function Media() {
  const [isPlaying, setIsPlaying] = createState(false)
  const [hasPlayer, setHasPlayer] = createState(false)
  // ── compact icon — 3 states: idle | paused | playing ─────
  let currentPlayer: any = null
  let playing = false

  // state: "idle" | "paused" | "playing"
  type CompactState = "idle" | "paused" | "playing"
  let compactState: CompactState = "idle"

  const bars = [0, 0.5, 1.1].map(makeBar)

  // note — idle state
  const noteDa = new Gtk.DrawingArea()
  noteDa.set_size_request(28, 28)
  noteDa.set_draw_func((_w, cr) => drawNote(cr, 14, 14))

  const compactBox = new Gtk.Box()
  compactBox.set_spacing(2)
  compactBox.set_halign(Gtk.Align.CENTER)
  compactBox.set_valign(Gtk.Align.CENTER)
  compactBox.append(noteDa)
  bars.forEach((b) => compactBox.append(b.da))

  const syncCompact = (state: CompactState) => {
    compactState = state
    playing = state === "playing"
    if (state === "idle") {
      // no player — note only
      noteDa.set_visible(true)
      bars.forEach((b) => {
        b.stop()
        b.da.set_visible(false)
      })
    } else if (state === "paused") {
      // player exists but paused — static dim bars
      noteDa.set_visible(false)
      bars.forEach((b) => {
        b.stop()
        b.da.set_visible(true)
      })
    } else {
      // playing — animated bars
      noteDa.set_visible(false)
      bars.forEach((b) => {
        b.da.set_visible(true)
        b.start()
      })
    }
  }

  syncCompact("idle")

  // ── popup card — AudioPlayer logic from CC, verbatim ───────
  const popover = new Gtk.Popover()
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.RIGHT)
  popover.add_css_class("media-popover")
  popover.set_autohide(true)

  // ── AudioPlayer internals (from CC) ──────────────────────
  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    css_classes: ["cc-audio-container"],
    spacing: 8,
  })

  const clearContainer = () => {
    let c = container.get_first_child()
    while (c) {
      container.remove(c)
      c = container.get_first_child()
    }
  }

  const buildPlayerCard = (player: any) => {
    const card = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      css_classes: ["cc-audio-card"],
      spacing: 4,
    })

    const sourceLbl = new Gtk.Label({
      label: (player.identity || player.bus_name || "Unknown").replace(
        /\.instance\d+$/,
        "",
      ),
      css_classes: ["cc-audio-source"],
      halign: Gtk.Align.START,
    })
    card.append(sourceLbl)

    const row = new Gtk.Box({ spacing: 8 })

    const ART_SIZE = 36
    const art = new Gtk.Image({
      pixel_size: ART_SIZE,
      css_classes: ["cc-audio-art"],
    })
    art.set_size_request(ART_SIZE, ART_SIZE)

    const loadArt = async (url: string) => {
      if (!url) {
        art.set_from_icon_name("audio-x-generic-symbolic")
        return
      }
      try {
        // resolve to a local path
        let path = url
        if (url.startsWith("file://")) {
          path = url.replace("file://", "")
        } else if (url.startsWith("http://") || url.startsWith("https://")) {
          const tmp = `/tmp/ags_art_${Date.now()}.jpg`
          const { execAsync } = await import("ags/process")
          await execAsync(["curl", "-sL", url, "-o", tmp])
          path = tmp
        }
        art.set_from_file(path)
      } catch {
        art.set_from_icon_name("audio-x-generic-symbolic")
      }
    }

    const setArt = () => {
      loadArt(player.art_url || "").catch(() => {})
    }
    setArt()
    player.connect("notify::art-url", setArt)

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
      max_width_chars: 20,
    })
    const artist = new Gtk.Label({
      label: player.artist || "",
      css_classes: ["cc-audio-artist"],
      halign: Gtk.Align.START,
      ellipsize: 3,
      max_width_chars: 20,
    })
    player.connect("notify::title", () =>
      title.set_label(player.title || "Unknown"),
    )
    player.connect("notify::artist", () =>
      artist.set_label(player.artist || ""),
    )
    meta.append(title)
    meta.append(artist)

    const mkBtn = (icon_name: string, cb: () => void) => {
      const btn = new Gtk.Button({ css_classes: ["cc-audio-ctrl-btn"] })
      btn.set_child(new Gtk.Image({ icon_name, pixel_size: 14 }))
      btn.connect("clicked", cb)
      return btn
    }

    const playIcon = new Gtk.Image({ pixel_size: 16 })
    const syncPlayIcon = () => {
      playIcon.icon_name =
        player.playback_status === MprisClass.PlaybackStatus.PLAYING
          ? "media-playback-pause-symbolic"
          : "media-playback-start-symbolic"
    }
    syncPlayIcon()
    player.connect("notify::playback-status", () => {
      syncPlayIcon()
      const nowPlaying =
        player.playback_status === MprisClass.PlaybackStatus.PLAYING
      setIsPlaying(nowPlaying)
      syncCompact(nowPlaying ? "playing" : "paused")
    })

    const playBtn = new Gtk.Button({ css_classes: ["cc-audio-play-btn"] })
    playBtn.set_child(playIcon)
    playBtn.connect("clicked", () => player.play_pause())

    const ctrlBox = new Gtk.Box({ spacing: 2, valign: Gtk.Align.CENTER })
    ctrlBox.append(
      mkBtn("media-skip-backward-symbolic", () => player.previous()),
    )
    ctrlBox.append(playBtn)
    ctrlBox.append(mkBtn("media-skip-forward-symbolic", () => player.next()))

    row.append(art)
    row.append(meta)
    row.append(ctrlBox)
    card.append(row)

    if (player.length > 0) {
      const progress = new Gtk.Scale({
        orientation: Gtk.Orientation.HORIZONTAL,
        draw_value: false,
        height_request: 4,
        hexpand: true,
      })
      progress.set_range(0, player.length)
      progress.set_value(player.position || 0)
      player.connect("notify::position", () =>
        progress.set_value(player.position || 0),
      )
      card.append(progress)
    }

    return card
  }

  const update = () => {
    clearContainer()
    const players: any[] = (Mpris as any)?.players ?? []
    if (!players.length) {
      currentPlayer = null
      setHasPlayer(false)
      setIsPlaying(false)
      syncCompact("idle")
      container.append(
        new Gtk.Label({
          label: "Nothing playing",
          css_classes: ["cc-audio-artist"],
        }),
      )
      return
    }
    setHasPlayer(true)
    const sorted = [...players].sort((a, b) => {
      const aP = a.playback_status === MprisClass.PlaybackStatus.PLAYING ? 0 : 1
      const bP = b.playback_status === MprisClass.PlaybackStatus.PLAYING ? 0 : 1
      return aP - bP
    })
    currentPlayer = sorted[0]
    const nowPlaying =
      currentPlayer.playback_status === MprisClass.PlaybackStatus.PLAYING
    setIsPlaying(nowPlaying)
    syncCompact(nowPlaying ? "playing" : "paused")
    sorted.forEach((p) => container.append(buildPlayerCard(p)))
  }

  Mpris?.connect("notify::players", update)

  popover.set_child(container)

  // ── root ──────────────────────────────────────────────────
  const root = new Gtk.Box()
  root.set_halign(Gtk.Align.CENTER)
  root.set_valign(Gtk.Align.CENTER)
  root.append(compactBox)

  root.connect("realize", () => {
    popover.set_parent(root)
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
      update()
      return GLib.SOURCE_REMOVE
    })
  })

  // click to toggle popover
  const click = new Gtk.GestureClick()
  click.connect("pressed", () => {
    if (popover.get_visible()) popover.popdown()
    else popover.popup()
  })
  root.add_controller(click)

  return root
}
