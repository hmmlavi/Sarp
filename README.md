<div align="center">

###

# 🐍 SARP

### *Eat · Grow · Don't Crash*

A juicy **3D arcade snake game** that runs in your browser — built with Three.js, React and a lot of screen shake.

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186-049ef4?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Made by Lavi](https://img.shields.io/badge/%F0%9F%92%9C_Made_by-Lavi-ff6ad5)](.)

**🎯 Classic focus meets arcade chaos** — play it straight, or chase the rare **Rainbow Apple** and turn the whole arena into a disco.

</div>

---

## 🎮 About

**Sarp** is a fast, polished take on the classic Snake formula. Steer a golden-eyed serpent around a glowing emerald pit, scarf apples, build combos, and discover surprise events — all in smooth 60fps 3D.

> The whole game compiles to **one single `index.html` file** — no build folder, no asset server, just open it and play. 📦

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🎥 | **True 3D arena** | 21×21 board with a camera that auto-fits any screen — desktop, tablet or phone |
| 🎮 | **Tight controls** | Keyboard, swipe-anywhere, and an on-screen D-pad. Input queues 3 moves deep so fast turns never drop |
| 🍎 | **Classic loop** | Eat → grow → speed up. The pace ramps from a relaxed crawl to a full sprint |
| 🌈 | **Rainbow Mode** | The headline event — see below! |
| 🥇 | **Golden Apple** | Rare shine, worth **5× score** |
| 🧲 | **Magnet Apple** | Pulls nearby apples toward you for 8 seconds |
| ⚡ | **Combo System** | Chain apples within 3.4s to stack a score multiplier |
| 🔥 | **Fever Mode** | Hit combo ×5 for 9 seconds of sparks, speed and glory |
| ✨ | **Spark Trail** | Electric sparks trail your body while powered up |
| 🎨 | **6 Random Skins** | Classic, Metallic, Electric, Space, Rainbow, Cartoon — new skin every run |
| 🌦️ | **Weather Events** | Rain, snow and light storms drift across the arena |
| 🪩 | **Dancing Crowd** | Little spectators party on the sidelines during special modes |
| 🏆 | **8 Achievements** | Unlockable and saved between sessions |
| 🎵 | **Dynamic Music** | A procedural soundtrack that morphs with your gameplay state |
| 📈 | **Local High Scores** | Top 8 runs saved on your device |

---

## 🕹️ Controls

### ⌨️ Keyboard

| Key | Action |
|:---:|---|
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | Steer |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Steer (alt) |
| <kbd>Space</kbd> / <kbd>P</kbd> / <kbd>Esc</kbd> | Pause / Resume |
| <kbd>R</kbd> | Instant restart |
| <kbd>M</kbd> | Mute / Unmute |
| <kbd>Q</kbd> | Quit to menu *(from pause)* |

### 📱 Touch

- **Swipe anywhere** on screen to steer — chain swipes for sharp turns
- Or use the **on-screen D-pad** in the corner
- Tap the **⏸ center button** to pause

---

## 🍎 Apples & Power-Ups

| | Item | Effect | Frequency |
|---|---|:---|---|
| 🍎 | **Apple** | +10 base score, grows you by 1 | Always present |
| 🥇 | **Golden Apple** | **5× score** of a normal apple | Occasional |
| 🧲 | **Magnet Apple** | Nearby apples drift toward you for **8s** | Occasional |
| 🌈 | **Rainbow Apple** | Triggers **Rainbow Mode** for **10s** | Every 10th, 25th, 40th, 55th… apple |

Every apple also advances the **speed ramp** — the board gets steadily faster the longer you survive.

---

## 🌈 Rainbow Mode

The rare event that turns Sarp upside down. After your **10th** apple (then every 15 after — 25, 40, 55, 70…), a glowing rainbow apple appears with orbiting sparkles and a light shaft. Eat it and:

<div align="center">
<img src="docs/rainbow-mode.jpg" alt="Sarp Rainbow Mode — disco stage" width="88%"/>
</div>

| ⚡ Effect | Detail |
|---|---|
| 🏎️ **Massive speed boost** | Smoothly ramps in — fast but never uncontrollable |
| 🍎 **10 apples at once** | The arena fills with apples; eaten ones respawn instantly |
| 💀 **Immortality** | Pass straight through your own body — walls can't kill you either |
| 🪩 **Disco Stage** | The arena itself transforms: pulsing rainbow dance floor, rotating mirror ball, orbiting colored lights |
| 🕺 **Crowd goes wild** | Spectators dance and jump on the sidelines |

A countdown ring shows exactly how long you have left. After **10 seconds**, everything smoothly returns to normal — speed, collisions, apples, lighting, the works. No leftovers, no broken state.

---

## ⚡ Combo & Fever

```text
🍎 eat → 🍎 eat (within 3.4s) → 🍎 eat (within 3.4s) → ...

  COMBO ×2  ·  COMBO ×3  ·  COMBO ×4  ·  COMBO ×5 💥
                                              │
                                        FEVER MODE
                                   (9s of sparks + speed)
```

- Each combo step raises your **score multiplier**
- Wait too long and the combo resets to zero
- Reaching **×5** ignites **Fever Mode** — sparks fly, the crowd cheers, and your multiplier climbs even higher

---

## 🎨 Random Skins

A new skin is picked automatically at the start of every run — no menus, just variety:

| Skin | Look |
|---|---|
| 🟢 **Classic** | The original emerald green serpent with a golden head |
| ⚪ **Metallic** | Chrome and steel with mirror shine |
| 🔵 **Electric** | Cyan-to-navy plasma glow |
| 🟣 **Space** | Violet nebula tones |
| 🌈 **Rainbow** | Red-to-cyan spectrum body |
| 🟠 **Cartoon** | Bright pink-and-orange playful palette |

> Rainbow Mode temporarily repaints your body in a full spectrum, then hands your skin back.

---

## 🏆 Achievements

| | Achievement | How to earn |
|---|---|---|
| 🍎 | **First Bite** | Eat your first apple |
| 🎯 | **Apple Hunter** | Eat 50 apples |
| 🥇 | **Golden Touch** | Eat a Golden Apple |
| ⚡ | **Combo Starter** | Reach Combo ×5 |
| 🔥 | **Fever Time** | Activate Fever Mode |
| 🌈 | **Rainbow Hunter** | Eat a Rainbow Apple |
| 💨 | **Speed Demon** | Survive a Fever or Rainbow event |
| 💯 | **100 Club** | Reach 100 apples |

Progress is saved in your browser and persists between sessions. ✅

---

## 🎵 Dynamic Music

The soundtrack is **generated live with the WebAudio API** — no audio files, no downloads. A tiny step-sequencer morphs its tempo, instruments and layer volumes as you play, so transitions are always smooth crossfades, never hard cuts:

| State | Mood |
|---|---|
| 🌿 Normal play | Relaxed groove |
| ⚡ High combo | Brighter and more driving |
| 🔥 Fever Mode | Fast, energetic, percussive |
| 🌈 Rainbow Mode | Full disco party 🪩 |

All sound effects — eating, turning, crashing, power-ups, the achievement fanfare — are synthesized the same way. The entire audio system is **0 bytes of assets**. 🔊

---

## 🧱 Tech Stack

<p>
<img src="https://img.shields.io/badge/React-19.2-61dafb?logo=react&logoColor=white" alt="React"/>
<img src="https://img.shields.io/badge/Three.js-0.186-049ef4?logo=threedotjs&logoColor=white" alt="Three.js"/>
<img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Vite-7.3-646cff?logo=vite&logoColor=white" alt="Vite"/>
<img src="https://img.shields.io/badge/Tailwind_CSS-4.1-38bdf8?logo=tailwindcss&logoColor=white" alt="Tailwind"/>
</p>

- **Three.js** — all 3D rendering, custom GLSL shaders for the disco floor
- **React 19** — menus, HUD and overlays
- **Tailwind CSS 4** — the arcade UI theme
- **Custom particle engine** — GPU point sprites, fully pooled, zero per-frame allocations
- **Zero asset files** — every texture is drawn to a `<canvas>` at runtime, every sound is synthesized
- **`vite-plugin-singlefile`** — bundles the whole game into one portable HTML file

---

## 📁 Project Structure

```text
src/
├── App.tsx                  # App shell — screens, input, event wiring
├── ui.tsx                   # HUD, menus, popups, badges, toasts
├── index.css                # Tailwind theme + arcade animations
└── game/
    ├── engine.ts            # 🧠 Core game loop, snake, collision, rainbow mode, disco stage
    ├── worldfx.ts           # Weather, crowd, spark trail orchestration
    ├── ambience.ts          # Rain / snow / storm + spark particles
    ├── crowd.ts             # Dancing spectators
    ├── particles.ts         # Pooled GPU particle system
    ├── music.ts             # Procedural adaptive soundtrack
    ├── audio.ts             # Synthesized sound effects
    ├── skins.ts             # Random snake skin definitions
    ├── achievements.ts      # Achievement list + persistence
    └── scores.ts            # Local high-score table
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `20.19+` (or `22.12+`) and npm — required by Vite 7

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/sarp.git
cd sarp

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) and start slithering. 🐍

### Production Build

```bash
# Build the game
npm run build

# Preview the production build locally
npm run preview
```

The build outputs a **single self-contained `dist/index.html`** (~880 KB). You can drop that one file on any static host and it just works.

---

## 🌐 Deploy

<details>
<summary><b>📦 Deploy to GitHub Pages</b></summary>

Because the build is a single file, deployment is trivial:

1. Build the project:
   ```bash
   npm run build
   ```
2. Copy `dist/index.html` into a `gh-pages` branch or an `docs/` folder
3. In your repo, go to **Settings → Pages** and set the source to that branch/folder

Or automate it:
```bash
npx gh-pages -d dist
```

> 💡 If the site lives at `https://user.github.io/repo/` rather than the domain root, set
> `base: "/repo/"` in `vite.config.ts` before building.

</details>

<details>
<summary><b>⚡ One-click hosts</b></summary>

Drag `dist/index.html` onto any of these and you're live:

- [Netlify Drop](https://app.netlify.com/drop)
- [Vercel](https://vercel.com)
- [Cloudflare Pages](https://pages.cloudflare.com)
- [itch.io](https://itch.io) *(as an HTML5 game)* 🎮

</details>

---

## ⚡ Performance

Sarp targets a locked **60fps on desktop and mobile**:

- 🧊 Capped pixel ratio (1.8 on touch devices, 2 on desktop)
- 🎱 Shared geometries and materials — no per-segment allocations
- ♻️ Pooled particles and reused scratch buffers — nothing is created inside the render loop
- 💡 All lights exist from frame one with intensity `0`, so no mid-game shader recompiles
- 🌫️ No shadow maps — lighting is kept cheap on purpose
- ⏱️ All timers run off the single `requestAnimationFrame` loop — no duplicate intervals to leak

---

## 💾 Data Storage

Sarp stores your progress locally in `localStorage` — no accounts, no servers:

| Key | Contents |
|---|---|
| `serpent3d.scores.v1` | Top 8 high scores |
| `sarp.achievements.v1` | Unlocked achievements |
| `serpent3d.muted` | Sound preference |

Clearing your browser data for the site resets your records.

---

## 🗺️ Roadmap

- [ ] 🎮 Gamepad support
- [ ] 🌍 Online leaderboard
- [ ] 🧩 Obstacle modes
- [ ] 🏅 Per-skin achievements

---

## 🤝 Contributing

Found a bug or got an idea? Contributions are welcome!

1. 🍴 Fork the repo
2. 🌿 Create a branch — `git checkout -b feature/my-idea`
3. 💾 Commit your changes
4. 🚀 Push and open a Pull Request

---

<div align="center">

## 💜 Credits

**Concept · Code · Design · Sound**

### **Lavi** ✨

*A tiny snake, a big arena, and far too many particles.*

🐍 **SARP** 🐍

**⭐ Star this repo if you had fun! ⭐**

</div>
