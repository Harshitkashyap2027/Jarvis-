# Project A.E.T.H.E.R.

**Advanced Environment for Task Handling and Executive Routing**

A JARVIS-style local AI assistant with full OS control, voice interface, real-time system telemetry, and a sci-fi web dashboard — running entirely on your own machine.

---

## ✨ Features

| Module | Capabilities |
|---|---|
| **OS Control** | Launch/kill applications, lock screen, sleep, shutdown, restart, set volume & brightness, open URLs and folders |
| **File Management** | Organise Downloads folder by type, scaffold React components & Node.js projects, read/write/move/delete files |
| **Macro Simulation** | Mouse movement & clicks, keyboard simulation, media key presses (play/pause, next/previous, mute) |
| **Dev Orchestration** | Open VS Code, start npm scripts, run builds, full Git workflow (commit/push/pull), Docker Compose management, workspace initialisation |
| **Real-Time Telemetry** | Live CPU usage & temperature, RAM, GPU load & temperature, disk usage, network throughput — streamed to the dashboard every 2 s |
| **Voice I/O** | Web Speech API STT + TTS; LLM-powered intent parsing (OpenAI / Gemini / Anthropic) → strict JSON command routing |
| **Sci-Fi Dashboard** | Glassmorphism UI with neon cyan/blue accents, animated orb, audio visualizer, particle background, command log |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────┐
│           WEB BROWSER (Frontend)          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  index.  │  │  app.js  │  │ audio- │  │
│  │  html    │  │ (Socket  │  │ visual │  │
│  │ + CSS    │  │  logic)  │  │ izer   │  │
│  └──────────┘  └──────────┘  └────────┘  │
│        Web Speech API (STT + TTS)         │
└───────────────────┬──────────────────────┘
                    │  WebSocket (Socket.io)
┌───────────────────▼──────────────────────┐
│           NODE.JS BACKEND (server.js)     │
│  ┌─────────────────────────────────────┐  │
│  │        LLM Router (llmRouter.js)    │  │
│  │  Voice text → JSON command object   │  │
│  └──────────────────┬──────────────────┘  │
│  ┌───────┬──────────▼──┬──────┬────────┐  │
│  │  OS   │   Files     │Macro │  Dev   │  │
│  │ Inter │  Manager    │ Ctrl │ Orch.  │  │
│  │ face  │             │      │        │  │
│  └───────┴─────────────┴──────┴────────┘  │
│         Telemetry (systeminformation)      │
│      Listens on 127.0.0.1 ONLY            │
└──────────────────────────────────────────┘
```

### Command Flow

1. **Voice capture** — Browser Web Speech API transcribes speech to text.
2. **Send** — Text is sent to the backend via Socket.io `voice_input` event.
3. **Parse** — The LLM Router sends the text to your chosen LLM (OpenAI/Gemini/Anthropic). The LLM is strictly instructed to reply **only** with a JSON command object: `{ "module": "os", "action": "lock_screen", "params": {} }`.
4. **Route** — The backend command router dispatches to the correct controller.
5. **Execute** — The controller runs the OS/file/macro/dev operation.
6. **Respond** — A success/error event is sent back to the frontend, triggering a TTS response and a log entry.

---

## 📁 Project Structure

```
project-aether/
├── server.js                  # Backend entry point
├── package.json
├── .env.example               # Environment variable template
├── .gitignore
├── controllers/
│   ├── osInterface.js         # OS commands (launch, kill, lock, volume…)
│   ├── fileManager.js         # File system operations & scaffolding
│   ├── macroController.js     # Mouse/keyboard/media macro simulation
│   ├── devOrchestrator.js     # Git, npm, VS Code, Docker
│   ├── telemetry.js           # Real-time system metrics
│   └── llmRouter.js           # LLM-powered natural language → JSON
├── public/
│   ├── index.html             # Sci-fi dashboard
│   ├── css/
│   │   └── style.css          # Glassmorphism / neon CSS3 animations
│   └── js/
│       ├── app.js             # Frontend Socket.io + Speech API logic
│       └── audio-visualizer.js# Web Audio API circular waveform
└── tests/
    └── controllers.test.js    # Node.js built-in test runner
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js ≥ 18.0.0**
- An API key from [OpenAI](https://platform.openai.com/), [Google AI Studio](https://aistudio.google.com/), or [Anthropic](https://console.anthropic.com/).
- *(Optional)* Build tools for native modules (`node-gyp`, Python, C++ compiler) if you want hardware macro simulation via `@jitsi/robotjs`.

### Installation

```bash
git clone https://github.com/Harshitkashyap2027/Jarvis-.git
cd Jarvis-
npm install
```

### Configuration

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
OPENAI_API_KEY=your_key_here     # or GEMINI_API_KEY / ANTHROPIC_API_KEY
LLM_PROVIDER=openai              # openai | gemini | anthropic
WORKSPACE_DIR=/home/you/projects # default project directory
DOWNLOADS_DIR=/home/you/Downloads
```

### Run

```bash
npm start
```

Then open **http://127.0.0.1:3000** in your browser.

> ⚠️ The server only binds to `127.0.0.1`. Never expose this port to the internet.

---

## 🎙 Voice Command Examples

| You say… | What happens |
|---|---|
| *"Lock the screen"* | OS screen lock |
| *"Set volume to 40"* | System volume → 40% |
| *"Launch Visual Studio Code"* | Opens VS Code |
| *"Kill Chrome"* | Force-terminates Chrome |
| *"Clean up my downloads folder"* | Organises Downloads by file type |
| *"Create a React component called Dashboard"* | Scaffolds `.jsx` + `.css` |
| *"Commit these changes as fixed layout and push to main"* | Git add → commit → push |
| *"Initialize my web development workspace"* | Opens VS Code + browser + starts server |
| *"What's my CPU temperature?"* | Returns live telemetry snapshot |
| *"Pause the music"* | Simulates Play/Pause media key |
| *"Put the computer to sleep"* | System sleep |

---

## 🔧 Adding New Commands

1. Add your function to the appropriate controller in `controllers/`.
2. Register the new `action` in the `routeCommand` switch in `server.js`.
3. Add the action's description to the `SYSTEM_PROMPT` in `controllers/llmRouter.js`.

That's it — the LLM automatically learns to route new commands once they are described in the prompt.

---

## 🧪 Running Tests

```bash
npm test
```

Tests use the Node.js built-in `node:test` runner (no extra dependencies).

---

## 🔒 Security Notes

- The server binds **only to `127.0.0.1`** — it is never reachable from outside your machine.
- All OS commands are executed through Node.js `child_process.exec` with a 15-second timeout.
- API keys are stored in `.env` which is **gitignored** — never commit your `.env`.
- The `execute_command` action allows arbitrary shell execution and should be used carefully.

---

## 🗺 Roadmap

- [ ] ElevenLabs TTS integration for a high-fidelity JARVIS voice
- [ ] Persistent command history with SQLite
- [ ] Plugin system for user-defined modules
- [ ] Mobile-responsive dashboard
- [ ] Wake-word detection ("Hey A.E.T.H.E.R.")
- [ ] Notification system integration (OS native notifications)
- [ ] Browser extension for cross-tab control

---

## 📜 License

MIT © Harshitkashyap2027
