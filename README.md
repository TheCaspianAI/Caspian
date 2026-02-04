# Caspian

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](#)
[![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)](#)
[![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)](#)

**The control plane for AI coding agents.**

Run multiple agents in parallel. Each in its own workspace. All from one screen.

<!-- TODO: Add demo GIF/video -->

---

## Why Caspian?

Running multiple Claude Code agents gets messy fast:

- **No visibility** — 5 terminals, 5 agents, endless cmd+tab
- **No isolation** — agents stepping on each other's changes
- **No persistence** — close a terminal, lose the context

**The result?** Your brain becomes the bottleneck. More agents = more chaos.

Caspian fixes this. One screen. All your agents. Each in its own isolated workspace.

---

## Features

| Feature | Description |
|---------|-------------|
| **Isolated Workspaces** | Each agent gets its own git worktree. No conflicts. |
| **Parallel Execution** | Run as many agents as you want, simultaneously. |
| **Unified Dashboard** | All agents on one screen. See everything at a glance. |
| **Live Monitoring** | Watch every agent in real-time. |
| **Persistent Sessions** | Close the app, come back later. Everything's still there. |
| **PR Integration** | Ship changes as pull requests when you're done. |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.0+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

### Install & Run

```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
bun install
bun dev
```

### Build

```bash
# macOS
bun run build:mac

# Linux
bun run build:linux

# Windows
bun run build:win

# All platforms
bun run build
```

---

## How It Works

```
1. Add repo     →  Point Caspian at your project
2. Create node  →  Spin up an isolated workspace (git worktree)
3. Run agent    →  Launch Claude Code in that workspace
4. Monitor      →  Watch progress in real-time
5. Review       →  Check the diff
6. Ship         →  Create a PR
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Caspian Desktop App                │
├─────────────────────────────────────────────────┤
│  Renderer (React)                               │
│  • Real-time agent streaming                    │
│  • Multi-workspace dashboard                    │
│  • Diff viewer & review mode                    │
├─────────────────────────────────────────────────┤
│  Main Process (Electron + Node.js)              │
│  • Git worktree orchestration                   │
│  • Terminal daemon management                   │
│  • File system operations                       │
│  • SQLite persistence                           │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-2596BE?logo=trpc&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)

---

## Roadmap

**Coming soon: Custom Workflows**

Finding the best way to work with AI agents is hard. We're building workflow templates that capture best practices — so you can plug in what works instead of starting from scratch.

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run checks: `bun run lint && bun run typecheck && bun test`
5. Commit your changes
6. Push to your fork and open a Pull Request

For detailed guidelines, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

Please read our **[Code of Conduct](CODE_OF_CONDUCT.md)** before contributing.

---

## Community

- [Report a bug](https://github.com/TheCaspianAI/Caspian/issues/new?template=bug_report.md)
- [Request a feature](https://github.com/TheCaspianAI/Caspian/issues/new?template=feature_request.md)
- [Start a discussion](https://github.com/TheCaspianAI/Caspian/discussions)

---

## License

[MIT](LICENSE)

---

<p align="center">
  <a href="https://trycaspianai.com">Website</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/TheCaspianAI/Caspian/issues">Issues</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/TheCaspianAI/Caspian/discussions">Discussions</a>
</p>

<p align="center">
  If you find Caspian useful, consider giving it a ⭐
</p>
