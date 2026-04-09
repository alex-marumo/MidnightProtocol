# MIDNIGHT-PROTOCOL

> _A Setup built by man, in the image of a dream he had in the days of old. A dream of a future imagined by the ANCIENTS, truly a nostalgic dystopian future. Built on the bare bones of Caelestia and End-4. They did the heavy lifting; I just wired it together._

![GitHub last commit](https://img.shields.io/github/last-commit/alex-marumo/midnightprotocol)
![GitHub repo size](https://img.shields.io/github/repo-size/alex-marumo/midnightprotocol)

---

## THE OVERVIEW

**MidnightProtocol** is a custom hyprland setup, built at a personal level. It’s built on AGS v3 (Astal) and moves away from the dull taste of peasents.

---

<img src="https://github.com/user-attachments/assets/d5b8aec6-49bb-4530-900c-b25f4aef5522" alt="image" width="300" height="auto" /> 
<img src="https://github.com/user-attachments/assets/6983e393-d111-4d5b-9203-9291d0245382" alt="image" width="300" height="auto" /> 
<img src="https://github.com/user-attachments/assets/80264aec-de7b-49eb-9b08-4d537f790cf4" alt="image" width="300" height="auto" /> 
<img src="https://github.com/user-attachments/assets/ee676f63-bb60-4424-940c-4696b92b513f" alt="image" width="300" height="auto" /> 
<img src="https://github.com/user-attachments/assets/52776f55-f560-4f7b-a25d-01bc3b4c2cc5" alt="image" width="300" height="auto" />

---

## THE ARSENAL

The tools chosen to defend this realm of ARCH (...btw):

| ROLE              | WEAPON                                              |
| :---------------- | :-------------------------------------------------- |
| **The Blueprint** | [Hyprland](https://hyprland.org) (The Compositor)   |
| **The Architect** | [AGS v3](https://github.com/Aylur/ags) (Astal / TS) |
| **The Void**      | [Kitty](https://sw.kovidgoyal.net/kitty) (Terminal) |
| **The Scribe**    | Neovim (LazyVim)                                    |
| **The Archivist** | Yazi                                                |
| **The Pulse**     | EasyEffects + Wireplumber                           |

---

## CORE AUGMENTATIONS

- **THE ALCHEMIST (Dynamic Color Engine):** Matugen hit the mark just right.
- **THE VANGUARD (AGS Sidebar):** A floating pill containing the life signs of the machine—CPU, RAM, and Swap rings. Managed through a shared state layer that ensures that every toggle, from WiFi to the melodies, is synchronized in real-time.
- **THE NERVE CENTER:** A command panel designed for total control. Sliders for the senses, a night light that follows the sun (via hyprsunset), and a notification history (via swaync).
- **THE GRIMOIRE (Cheat Sheet):** Live-parsed keybinds paired with a **Cyber Kill Chain** reference. A relic left by the old ones.
- **THE MARK OF THE BEAST (Activate Linux):** A watermark that reminds of why we struggle.

---

## SHELL ARCHITECTURE

```
~/.config/
├── ags/                  # Widget system (AGS v3)
│   ├── scripts/          # additional scripts
│   ├── styles/           # modular styling
│   ├── widgets/          # All widgets
│   ├── state.ts          # Shared system state (wifi, bt, audio, vol)
│   ├── style.scss        # All GTK CSS
│   ├── colors.scss       # Matugen-generated palette
│   └── app.ts            # Entry point
│   └── cheatsheet.scss
```

---

## DEPLOYMENT

> **THE SURVIVOR'S WARNING:** This is a personal rig, not a mass-produced product. You must scavenge the dependencies yourself before it can breathe.

### 1. SECURE THE ASSETS

```bash
git clone https://github.com/alex-marumo/MidnightProtocol.git
cd MidnightProtocol
```

### 2. BIND THE SYSTEM

```bash
# Symlink your fate (adjust the path necessary)
ln -sf $(pwd)/.config/ags ~/.config/ags
ln -sf $(pwd)/.config/hypr ~/.config/hypr
# ... repeat for other configs
# Ignite the engine
cd ~/.config/ags && npm install
ags run ~/.config/ags/app.ts
```

---

## THE LINEAGE

- **Aylur** — _The Architect of AGS._
- **Caelestia** — _The Visionary._
- **End-4** — _The Impetus._
- **Alex Marumo** — _The Hand that forged this path._

---

## THE COVENANT

This code is released under the [LICENSE](LICENSE). _WITH GREAT POWER, DOES COME GREAT RESPONSIBILITY._

_AS THE ORACLES ONCE TOLD, THE NIGHT KNOWS NOT ITS BEAUTY\__
