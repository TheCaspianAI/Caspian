# Caspian

**The control plane for AI coding agents.**

Run multiple agents in parallel, with curated workflows that fit your team.

https://github.com/user-attachments/assets/3b154018-6e2e-462b-9621-1b92354ffef7

---

## The Problem

Running multiple Claude Code agents is frustrating.

**You end up with:**
- 5 terminals for 5 agents, constantly cmd+tabbing, forgetting which is which
- No way to see what's happening across all of them at once
- All agents working in the same directory, overwriting each other's changes
- Closing a terminal and losing all context

**You can't scale.** The more agents you run, the harder it is to keep track. Switch tabs, lose context. Your brain becomes the bottleneck.

**You're forced to choose:** granular tasks with few agents, or many agents with coarse tasks. You can't have both.

There's no control plane. No dashboard. No structure.

---

## Caspian

Each agent gets its own isolated workspace. Run as many as you want. See everything from one screen.

**Granularity and scale. No tradeoff.**

---

## Features

| What | Why it matters |
|------|----------------|
| **Isolated Workspaces** | Each agent gets its own worktree. No more agents overwriting each other. |
| **Parallel Execution** | Run multiple agents on different tasks simultaneously. |
| **Single Dashboard** | See all your agents at once. No more tab switching. |
| **Live Monitoring** | Watch what every agent is doing in real-time. |
| **Persistent Context** | Close the app, come back later. Everything's still there. |
| **PR Integration** | Ship completed work directly as pull requests. |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Rust 1.77+
- Claude Code CLI

### Get running

```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
npm install
npm run tauri:dev
```

### Build for production

```bash
npm run tauri:build
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

```bash
npm install        # install deps
npm run tauri:dev  # dev server
npm run lint       # check your work
```

---

## License

MIT
