import { Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"

interface Message {
  role: "user" | "assistant"
  content: string
  time: string
}

const GREETINGS: Record<string, string[]> = {
  dawn: [
    "the sun rises, yet the night's questions linger.",
    "even dawn breaks slowly. what stirs you?",
  ],
  morning: [
    "the small council meets at this hour. what do you bring?",
    "the ravens fly early.",
  ],
  afternoon: [
    "the sun is high — even kings must answer questions.",
    "midday. the maesters are awake.",
  ],
  evening: [
    "the candles are lit. the ravens are restless. speak.",
    "evening falls. what troubles you?",
  ],
  night: [
    "the night is dark and full of queries.",
    "chaos isn't a pit. it's a ladder.",
  ],
}

function getGreeting(): string {
  const h = new Date().getHours()
  let bucket = "night"
  if (h >= 5 && h < 9) bucket = "dawn"
  else if (h >= 9 && h < 12) bucket = "morning"
  else if (h >= 12 && h < 17) bucket = "afternoon"
  else if (h >= 17 && h < 21) bucket = "evening"

  const pool = GREETINGS[bucket]
  return pool[Math.floor(Math.random() * pool.length)]
}

// ==================== CONFIG ====================
const AXL_PATH = "/home/alexm/Prjcts/A.X.L/target/release/axl"
const CONFIG_PATH = `${GLib.get_user_config_dir()}/aichat/config.yaml`

let currentMode: "cloud" | "local" = "cloud"
let currentModel = "openrouter:openai/gpt-oss-120b"

async function loadModelFromConfig() {
  try {
    const model = await execAsync([
      "sh",
      "-c",
      `yq '.model // "openrouter:openai/gpt-oss-120b"' ${CONFIG_PATH} 2>/dev/null || echo "openrouter:openai/gpt-oss-120b"`,
    ])
    currentModel = model.trim()
  } catch (_) {}
}

function getDisplayModel(): string {
  const name = currentModel.split(/[:/]/).pop() || currentModel
  return currentMode === "local" ? `LOCAL · ${name}` : `CLOUD · ${name}`
}

async function sendToAichat(text: string): Promise<string> {
  try {
    const args = [AXL_PATH, "--no-stream"]

    if (currentMode === "local") {
      args.push("--model", currentModel)
    }

    let output = await execAsync([...args, text])

    // Aggressive cleaning
    output = output
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^\s*thinking.*$/gim, "")
      .replace(/<\|.*?\|>/g, "") // remove any special tokens
      .trim()

    return output || "received no response."
  } catch (err: any) {
    console.error(err)
    return "transmission failed."
  }
}

async function killSession() {
  try {
    await execAsync(["pkill", "-f", "axl"])
  } catch (_) {}
}

// ==================== UI ====================
export default function AIChat() {
  const conversationHistory: Message[] = []

  const popover = new Gtk.Popover()
  popover.set_has_arrow(false)
  popover.set_position(Gtk.PositionType.RIGHT)
  popover.set_autohide(true)
  popover.add_css_class("ai-popover")
  popover.set_size_request(460, 650)

  // Tabs
  const tabBox = new Gtk.Box({ spacing: 0, cssClasses: ["ai-tabs"] })
  const cloudTab = new Gtk.Button({
    label: "☁ CLOUD",
    cssClasses: ["ai-tab", "ai-tab-active"],
  })
  const localTab = new Gtk.Button({ label: "󰣇 LOCAL", cssClasses: ["ai-tab"] })

  tabBox.append(cloudTab)
  tabBox.append(localTab)

  // Header
  const statusDot = new Gtk.Label({ label: "●", cssClasses: ["ai-status-dot"] })
  const titleLbl = new Gtk.Label({ label: "A.X.L", cssClasses: ["ai-title"] })
  const modelLbl = new Gtk.Label({ label: "", cssClasses: ["ai-model-tag"] })
  modelLbl.set_hexpand(true)
  modelLbl.set_halign(Gtk.Align.START)

  const clearBtn = new Gtk.Button({
    label: "⌫",
    cssClasses: ["ai-icon-btn"],
    tooltip_text: "Clear Chat",
  })
  const closeBtn = new Gtk.Button({
    label: "✕",
    cssClasses: ["ai-icon-btn"],
    tooltip_text: "End Session",
  })

  const headerLeft = new Gtk.Box({ spacing: 6 })
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
  scroll.set_size_request(430, 430)
  scroll.set_child(messageList)

  const input = new Gtk.TextView({
    wrap_mode: Gtk.WrapMode.WORD_CHAR,
    accepts_tab: false,
    hexpand: true,
  })
  input.add_css_class("ai-input")
  input.set_size_request(-1, 44)

  const inputWrap = new Gtk.ScrolledWindow()
  inputWrap.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
  inputWrap.set_size_request(-1, 44)
  inputWrap.set_child(input)

  const sendBtn = new Gtk.Button({
    cssClasses: ["ai-send-btn"],
    tooltip_text: "Send (Enter)",
  })
  sendBtn.set_child(new Gtk.Label({ label: "⏎" }))

  const inputRow = new Gtk.Box({ spacing: 6, cssClasses: ["ai-input-row"] })
  inputRow.append(new Gtk.Label({ label: "❯", cssClasses: ["ai-prompt"] }))
  inputRow.append(inputWrap)
  inputRow.append(sendBtn)

  const card = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    cssClasses: ["ai-card"],
  })
  card.set_size_request(460, 650)
  card.append(tabBox)
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

  // Tab Logic
  function updateTabs() {
    if (currentMode === "cloud") {
      cloudTab.add_css_class("ai-tab-active")
      localTab.remove_css_class("ai-tab-active")
    } else {
      localTab.add_css_class("ai-tab-active")
      cloudTab.remove_css_class("ai-tab-active")
    }
    modelLbl.label = getDisplayModel()
  }

  cloudTab.connect("clicked", () => {
    currentMode = "cloud"
    updateTabs()
  })
  localTab.connect("clicked", () => {
    currentMode = "local"
    updateTabs()
  })

  // Helpers
  function scrollToBottom() {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      const adj = scroll.get_vadjustment()
      adj.set_value(adj.get_upper() - adj.get_page_size())
      return GLib.SOURCE_REMOVE
    })
  }

  function renderMessage(msg: Message) {
    const row = new Gtk.Box({ spacing: 6, cssClasses: ["ai-line"] })
    row.append(new Gtk.Label({ label: `[${msg.time}]`, cssClasses: ["ai-ts"] }))
    row.append(
      new Gtk.Label({
        label: msg.role === "user" ? "ABYSS" : "A.X.L",
        cssClasses: ["ai-handle", `ai-handle--${msg.role}`],
      }),
    )
    row.append(new Gtk.Label({ label: "❯", cssClasses: ["ai-chevron"] }))

    row.append(
      new Gtk.Label({
        label: msg.content,
        wrap: true,
        xalign: 0,
        selectable: true,
        hexpand: true,
        cssClasses: ["ai-body", `ai-body--${msg.role}`],
      }),
    )

    messageList.append(row)
    scrollToBottom()
  }

  function clearMessageList() {
    let child = messageList.get_first_child()
    while (child) {
      const next = child.get_next_sibling()
      messageList.remove(child)
      child = next
    }
  }

  function renderGreeting() {
    const row = new Gtk.Box({ spacing: 8, cssClasses: ["ai-greeting"] })
    row.append(new Gtk.Label({ label: "🌑", cssClasses: ["ai-greeting-moon"] }))
    row.append(
      new Gtk.Label({
        label: getGreeting(),
        wrap: true,
        cssClasses: ["ai-greeting-text"],
      }),
    )
    messageList.append(row)
  }

  // Actions
  clearBtn.connect("clicked", () => {
    conversationHistory.length = 0
    clearMessageList()
    renderGreeting()
  })

  closeBtn.connect("clicked", async () => {
    await killSession().catch(console.error)
    popover.popdown()
  })

  async function handleSend() {
    const buf = input.get_buffer()
    const text = buf
      .get_text(buf.get_start_iter(), buf.get_end_iter(), false)
      .trim()
    if (!text) return

    buf.set_text("", 0)

    const userMsg: Message = { role: "user", content: text, time: now() }
    conversationHistory.push(userMsg)
    renderMessage(userMsg)

    const thinking = { role: "assistant", content: "……", time: now() }
    renderMessage(thinking)

    const reply = await sendToAichat(text)

    const last = messageList.get_last_child()
    if (last) messageList.remove(last)

    const assistantMsg: Message = {
      role: "assistant",
      content: reply,
      time: now(),
    }
    conversationHistory.push(assistantMsg)
    renderMessage(assistantMsg)
  }

  sendBtn.connect("clicked", handleSend)

  const keyCtrl = new Gtk.EventControllerKey()
  keyCtrl.connect("key-pressed", (_ctrl, keyval, _code, state) => {
    const isEnter = keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter
    if (isEnter && !(state & Gdk.ModifierType.SHIFT_MASK)) {
      handleSend()
      return true
    }
    return false
  })
  input.add_controller(keyCtrl)

  function now(): string {
    const d = new Date()
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }

  // Main Button
  const btn = new Gtk.Button({ cssClasses: ["logo-btn"] })
  btn.set_child(new Gtk.Label({ label: "鬼", cssClasses: ["logo"] }))

  btn.connect("realize", () => popover.set_parent(btn))

  btn.connect("clicked", () => {
    if (popover.get_visible()) {
      popover.popdown()
    } else {
      loadModelFromConfig()
        .then(() => {
          updateTabs()
          clearMessageList()
          renderGreeting()
          conversationHistory.forEach(renderMessage)

          popover.popup()

          // Aggressive focus
          GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            input.grab_focus()
            return GLib.SOURCE_REMOVE
          })
        })
        .catch(console.error)
    }
  })

  return btn
}
