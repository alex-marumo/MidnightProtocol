import { Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"

interface Message {
  role: "user" | "assistant"
  content: string
  time: string // "HH:MM"
}

const GREETINGS: Record<string, string[]> = {
  dawn: [
    // 05:00–08:59
    "the sun rises, yet the night's questions linger.",
    "even dawn breaks slowly in the north. what stirs you?",
    "a new day. the ravens are fed. speak.",
  ],
  morning: [
    // 09:00–11:59
    "the small council meets at this hour. what do you bring?",
    "the ravens fly early. yours has arrived.",
    "morning, and the realm still stands. what do you need?",
  ],
  afternoon: [
    // 12:00–16:59
    "the sun is high — even kings must answer questions.",
    "midday. the maesters are awake. so am i.",
    "the great game never sleeps, even at this hour.",
  ],
  evening: [
    // 17:00–20:59
    "the candles are lit. the ravens are restless. speak.",
    "evening falls on the realm. what troubles you?",
    "as the sun sets, the questions grow darker. ask.",
  ],
  night: [
    // 21:00–23:59 + 00:00–04:59
    "the night is dark and full of queries.",
    "what is dead may never die — ask anyway.",
    "the lone wolf dies, but the pack stays up late.",
    "chaos isn't a pit. it's a ladder. need a boost?",
  ],
}

function getGreeting(): string {
  const h = new Date().getHours()
  let bucket: string
  if (h >= 5 && h < 9) bucket = "dawn"
  else if (h >= 9 && h < 12) bucket = "morning"
  else if (h >= 12 && h < 17) bucket = "afternoon"
  else if (h >= 17 && h < 21) bucket = "evening"
  else bucket = "night"

  const pool = GREETINGS[bucket]
  return pool[Math.floor(Math.random() * pool.length)]
}

const conversationHistory: Message[] = []

function now(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export default function AIChat() {
  const popover = new Gtk.Popover()
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.RIGHT)
  popover.add_css_class("ai-popover")
  popover.set_autohide(true)

  const statusDot = new Gtk.Label({ label: "●", cssClasses: ["ai-status-dot"] })
  const titleLbl = new Gtk.Label({ label: "A.X.L", cssClasses: ["ai-title"] })
  const modelLbl = new Gtk.Label({
    label: "claude · midnight",
    cssClasses: ["ai-model-tag"],
  })
  modelLbl.set_hexpand(true)
  modelLbl.set_halign(Gtk.Align.START)

  const clearBtn = new Gtk.Button({
    label: "⌫",
    cssClasses: ["ai-icon-btn"],
    tooltip_text: "clear chat",
  })
  const closeBtn = new Gtk.Button({ label: "✕", cssClasses: ["ai-icon-btn"] })
  closeBtn.connect("clicked", () => popover.popdown())

  const headerLeft = new Gtk.Box({ spacing: 6, valign: Gtk.Align.CENTER })
  headerLeft.append(statusDot)
  headerLeft.append(titleLbl)
  headerLeft.append(modelLbl)

  const headerRight = new Gtk.Box({ spacing: 4 })
  headerRight.append(clearBtn)
  headerRight.append(closeBtn)

  const header = new Gtk.Box({ spacing: 6, cssClasses: ["ai-header"] })
  header.append(headerLeft)
  header.append(headerRight)

  const messageList = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 2,
    cssClasses: ["ai-message-list"],
  })

  const scroll = new Gtk.ScrolledWindow({ vexpand: true })
  scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  scroll.set_size_request(360, 420)
  scroll.add_css_class("ai-scroll")
  scroll.set_child(messageList)

  const prompt = new Gtk.Label({ label: "❯", cssClasses: ["ai-prompt"] })
  prompt.set_valign(Gtk.Align.CENTER)

  const input = new Gtk.TextView()
  input.set_wrap_mode(Gtk.WrapMode.WORD_CHAR)
  input.set_accepts_tab(false)
  input.set_hexpand(true)
  input.add_css_class("ai-input")
  input.set_size_request(-1, 36)

  const inputWrap = new Gtk.ScrolledWindow()
  inputWrap.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  inputWrap.set_size_request(-1, 36)
  inputWrap.set_child(input)

  const sendBtn = new Gtk.Button({
    cssClasses: ["ai-send-btn"],
    tooltip_text: "send (Enter)",
  })
  sendBtn.set_valign(Gtk.Align.CENTER)
  sendBtn.set_child(new Gtk.Label({ label: "⏎", cssClasses: ["ai-send-icon"] }))

  const inputRow = new Gtk.Box({ spacing: 6, cssClasses: ["ai-input-row"] })
  inputRow.append(prompt)
  inputRow.append(inputWrap)
  inputRow.append(sendBtn)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
    cssClasses: ["ai-card"],
  })
  card.append(header)
  card.append(
    new Gtk.Separator({
      orientation: Gtk.Orientation.HORIZONTAL,
      cssClasses: ["ai-sep"],
    }),
  )
  card.append(scroll)
  card.append(
    new Gtk.Separator({
      orientation: Gtk.Orientation.HORIZONTAL,
      cssClasses: ["ai-sep"],
    }),
  )
  card.append(inputRow)

  popover.set_child(card)

  function scrollToBottom() {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      const adj = scroll.get_vadjustment()
      adj.set_value(adj.get_upper() - adj.get_page_size())
      return GLib.SOURCE_REMOVE
    })
  }

  function renderMessage(msg: Message) {
    const handle = msg.role === "user" ? "abyss.w4lk3r" : " a.x.l"

    const timeLbl = new Gtk.Label({
      label: `[${msg.time}]`,
      cssClasses: ["ai-ts"],
      valign: Gtk.Align.START,
    })

    const handleLbl = new Gtk.Label({
      label: handle,
      cssClasses: ["ai-handle", `ai-handle--${msg.role}`],
      valign: Gtk.Align.START,
    })

    const chevron = new Gtk.Label({
      label: "❯",
      cssClasses: ["ai-chevron", `ai-chevron--${msg.role}`],
      valign: Gtk.Align.START,
    })

    const body = new Gtk.Label({
      label: msg.content,
      wrap: true,
      xalign: 0,
      selectable: true,
      hexpand: true,
      cssClasses: ["ai-body", `ai-body--${msg.role}`],
      valign: Gtk.Align.START,
    })

    const row = new Gtk.Box({ spacing: 6, cssClasses: ["ai-line"] })
    row.append(timeLbl)
    row.append(handleLbl)
    row.append(chevron)
    row.append(body)

    messageList.append(row)
    scrollToBottom()
  }

  function renderGreeting() {
    const greeting = getGreeting()

    const moonLbl = new Gtk.Label({
      label: "🌘",
      cssClasses: ["ai-greeting-moon"],
    })
    const textLbl = new Gtk.Label({
      label: greeting,
      wrap: true,
      xalign: 0,
      hexpand: true,
      cssClasses: ["ai-greeting-text"],
    })

    const row = new Gtk.Box({ spacing: 8, cssClasses: ["ai-greeting"] })
    row.append(moonLbl)
    row.append(textLbl)
    messageList.append(row)
  }

  clearBtn.connect("clicked", () => {
    conversationHistory.length = 0
    let child = messageList.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      messageList.remove(child)
      child = next
    }
    renderGreeting()
  })

  async function sendToProxy(messages: Message[]): Promise<string> {
    const tmpFile = `/tmp/aichat-${Date.now()}.json`

    const payload = JSON.stringify({
      model: "claude-sonnet-20240229",
      max_tokens: 2048,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    // Use python to write — avoids all shell quote escaping issues
    await execAsync([
      "python3",
      "-c",
      `import json; open('${tmpFile}', 'w').write('${payload.replace(/'/g, "\\'")}')`,
    ])

    const result = await execAsync([
      "bash",
      "-c",
      `curl -s -X POST http://localhost:8082/v1/messages \
      -H "Content-Type: application/json" \
      -H "x-api-key: A.X.L" \
      -d @${tmpFile} \
    | grep 'content_block_delta' \
    | grep '^data:' \
    | sed 's/^data: //' \
    | jq -r '.delta.text' \
    | tr -d '\\n'; rm -f ${tmpFile}`,
    ])

    return result.trim() || "the ravens brought back nothing."
  }

  function getInputText(): string {
    const buf = input.get_buffer()
    return buf.get_text(buf.get_start_iter(), buf.get_end_iter(), false).trim()
  }

  function clearInput() {
    input.get_buffer().set_text("", 0)
  }

  function handleSend() {
    const text = getInputText()
    if (!text) return
    clearInput()

    const userMsg: Message = {
      role: "user",
      content: text,
      time: now(),
    }
    conversationHistory.push(userMsg)
    renderMessage(userMsg)

    const thinkingMsg: Message = {
      role: "assistant",
      content: "...",
      time: now(),
    }
    renderMessage(thinkingMsg)

    sendToProxy(conversationHistory)
      .then((reply) => {
        const last = messageList.get_last_child()
        if (last) messageList.remove(last)

        const msg: Message = { role: "assistant", content: reply, time: now() }
        conversationHistory.push(msg)
        renderMessage(msg)
      })
      .catch(() => {
        const last = messageList.get_last_child()
        if (last) messageList.remove(last)

        renderMessage({
          role: "assistant",
          content: "the ravens failed to deliver. is the proxy running?",
          time: now(),
        })
      })
  }

  sendBtn.connect("clicked", handleSend)

  const keyCtrl = new Gtk.EventControllerKey()
  keyCtrl.connect("key-pressed", (_ctrl, keyval, _code, state) => {
    const enter = keyval === 0xff0d || keyval === 0xff8d
    const shift = state & Gdk.ModifierType.SHIFT_MASK
    if (enter && !shift) {
      handleSend()
      return true
    }
    return false
  })
  input.add_controller(keyCtrl)

  const btn = new Gtk.Button({ cssClasses: ["logo-btn"] })
  btn.set_halign(Gtk.Align.CENTER)
  btn.set_child(new Gtk.Label({ label: "鬼", cssClasses: ["logo"] }))

  btn.connect("realize", () => {
    popover.set_parent(btn)
  })

  btn.connect("clicked", () => {
    if (popover.get_visible()) {
      popover.popdown()
    } else {
      let child = messageList.get_first_child()
      while (child) {
        const next = child.get_next_sibling()
        messageList.remove(child)
        child = next
      }
      renderGreeting()
      conversationHistory.forEach(renderMessage)

      popover.popup()
      GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
        input.grab_focus()
        return GLib.SOURCE_REMOVE
      })
    }
  })

  return btn
}
