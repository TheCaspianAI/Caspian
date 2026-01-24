# Caspian

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)]()
[![Platform: Linux](https://img.shields.io/badge/Platform-Linux-lightgrey.svg)]()
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri-orange.svg)]()

**The control plane for AI coding agents.**

Run multiple agents in parallel. Each in its own workspace. All from one screen.

https://github.com/user-attachments/assets/3b154018-6e2e-462b-9621-1b92354ffef7

---

## The Problem

Running multiple Claude Code agents? It gets messy fast.

**Here's what happens:**
- 5 terminals, 5 agents, and you've already forgotten what the third one was doing
- No bird's-eye view — just endless cmd+tab until your brain gives up
- All agents stomping around the same directory, overwriting each other's work
- Close a terminal, poof — context gone forever

**The real problem?** You can't scale. Your brain becomes the bottleneck. More agents = more chaos.

**The tradeoff nobody asked for:** Run a few agents with focused tasks, or run many with vague ones. Pick one.

There's no control plane. No dashboard. No structure. Until now.

---

## Caspian

One screen. All your agents. Each in its own isolated workspace.

Run 10 agents on 10 focused tasks. See everything. Control everything.

**Granularity *and* scale.**

---

## Features

| What | Why it matters |
|------|----------------|
| **Isolated Workspaces** | Each agent gets its own worktree. No more stepping on each other's toes. |
| **Parallel Execution** | Run as many agents as you want, simultaneously. |
| **Single Dashboard** | All agents, one screen. Your brain can relax. |
| **Live Monitoring** | Watch every agent in real-time. See what they see. |
| **Persistent Context** | Close the app, grab coffee, come back. Everything's still there. |
| **PR Integration** | Done? Ship it as a pull request. |

---

## Quick Start

> **Note:** Caspian supports macOS and Linux (Ubuntu/Debian).

### Prerequisites
- Node.js 20.19+ or 22.12+ (required by Vite)
- Rust 1.77+
- Claude Code CLI

**Linux additional requirements:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

> **For detailed Linux setup instructions, see [LINUX_SETUP.md](LINUX_SETUP.md)**

### Get running

**macOS:**
```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
npm install
npm run tauri:dev
```

**Linux:**
```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
npm install
npm run tauri:dev:linux
```

### Build for production

**macOS:**
```bash
npm run tauri:build
```

**Linux:**
```bash
npm run tauri:build:linux
```

Output: `src-tauri/target/release/bundle/`

---

## How It Works

```
1. Add repo     →  Point Caspian at your project
2. Create node  →  Spin up an isolated workspace
3. Run agent    →  Launch Claude Code in that workspace
4. Watch        →  See everything in real-time
5. Review       →  Check the changes
6. Ship         →  Create a PR
```

---

## Roadmap

**Coming soon: Custom Workflows**

Finding the best way to work with AI agents is hard. Beads? Gastown? GSD? Something else entirely?

We're building workflow templates that capture best practices — so you can plug in what works for your team instead of figuring it out from scratch.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│              Caspian Desktop App               │
├────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                 │
│  • Real-time agent streaming                   │
│  • Multi-agent grid view                       │
│  • Diff viewer & review mode                   │
├────────────────────────────────────────────────┤
│  Backend (Rust + Tauri)                        │
│  • Git worktree orchestration                  │
│  • Agent process management                    │
│  • File system watching                        │
│  • SQLite persistence                          │
└────────────────────────────────────────────────┘
```

---

## Tech

**Frontend:** React 19, TypeScript, Tailwind, Zustand, Vite

**Backend:** Rust, Tauri 2, libgit2, SQLite, Tokio

---

## Contributing

PRs welcome.

```bash
npm install        # install deps
npm run tauri:dev  # dev server
npm run lint       # check your work
```

---

## License

MIT

---

## Links

[Website](https://trycaspianai.com)

---

If you find Caspian useful, give it a ⭐

---

Built by [Caspian](https://trycaspianai.com) and Claude Code
