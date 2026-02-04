# Caspian

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)]()
[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-47848F.svg)]()

**The control plane for AI coding agents.**

Run multiple agents in parallel. Each in its own workspace. All from one screen.

<!-- TODO: Add demo video -->
<!-- https://github.com/user-attachments/assets/... -->

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

> **Note:** Caspian currently supports macOS only.

### Prerequisites
- [Bun](https://bun.sh/) 1.0+
- Claude Code CLI

### Get running

```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
bun install
bun dev
```

### Build for production

```bash
bun run build
```

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
│  Backend (Electron Main Process)               │
│  • Git worktree orchestration                  │
│  • Terminal daemon management                  │
│  • File system operations                      │
│  • SQLite persistence                          │
└────────────────────────────────────────────────┘
```

---

## Tech

**Frontend:** React, TypeScript, Tailwind CSS v4, Zustand, TanStack Router

**Backend:** Electron, Bun, tRPC, Drizzle ORM, SQLite

---

## Contributing

PRs welcome.

```bash
bun install       # install deps
bun dev           # dev server
bun run lint      # check your work
bun run typecheck # type check
```

---

## License

MIT

---

## Links

[Website](https://trycaspianai.com)

---

If you find Caspian useful, give it a star!

---

Built by [Caspian](https://trycaspianai.com) and Claude Code
