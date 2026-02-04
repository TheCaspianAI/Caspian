<div align="center">

# Caspian

**The command center for AI coding agents**

<br/>

<!-- Replace with actual demo GIFs/videos when available -->
<img src="https://github.com/user-attachments/assets/placeholder-demo-1.gif" width="400"/>
&nbsp;&nbsp;
<img src="https://github.com/user-attachments/assets/placeholder-demo-2.gif" width="400"/>

<br/>
<br/>

Run multiple AI agents in parallel. Each in its own isolated workspace. All from one screen.

<br/>

<a href="#-quick-start">Quick Start</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://github.com/Alchemishty/SuperCaspian/discussions">Discussions</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="#-contributing">Contributing</a>

<br/>
<br/>

<img src="https://github.com/Alchemishty/SuperCaspian/actions/workflows/ci.yml/badge.svg" alt="CI"/>
&nbsp;
<img src="https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white" alt="macOS"/>
&nbsp;
<img src="https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black" alt="Linux"/>
&nbsp;
<img src="https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white" alt="Windows"/>
&nbsp;
<img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"/>

</div>

<br/>

## 💥 The Problem

Running multiple AI coding agents gets messy fast:

- **5 terminals, 5 agents** — endless `Cmd+Tab`
- **No visibility** — what's agent #3 doing?
- **No isolation** — agents overwriting each other
- **No persistence** — close terminal, lose everything

**Your brain becomes the bottleneck.** More agents = more chaos.

<br/>

## ✨ The Solution

<div align="center">

| | |
|:---:|:---:|
| **Isolated Workspaces** | Every agent gets its own git worktree. No conflicts. |
| **Parallel Execution** | Run unlimited agents simultaneously. |
| **Unified Dashboard** | All agents, one screen. No context switching. |
| **Real-time Monitoring** | Watch agents work live. |
| **Persistent Sessions** | Close app. Come back. Everything's there. |
| **Multi-Agent Support** | Claude Code, Codex, OpenCode — bring your own. |

</div>

<br/>

## 🚀 Quick Start

### Prerequisites

| Dependency | Version | Install |
|:-----------|:--------|:--------|
| [Bun](https://bun.sh/) | 1.0+ | `curl -fsSL https://bun.sh/install \| bash` |
| [Git](https://git-scm.com/) | 2.20+ | [Download](https://git-scm.com/downloads) |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Latest | `npm install -g @anthropic-ai/claude-code` |

> **Note:** You can use any terminal-based AI agent (Codex, Aider, etc.), but Claude Code is recommended.

### Install & Run

```bash
git clone https://github.com/Alchemishty/SuperCaspian.git
cd SuperCaspian
bun install
bun run dev
```

### Troubleshooting

<details>
<summary><b>Native module errors on first run?</b></summary>
<br/>

Run this to rebuild native modules for Electron:
```bash
bun run install:deps
```
</details>

<details>
<summary><b>Port already in use?</b></summary>
<br/>

Kill existing processes:
```bash
lsof -ti:5927 | xargs kill -9
```
</details>

<br/>

## 📦 Build

```bash
bun run build:mac     # macOS
bun run build:linux   # Linux
bun run build:win     # Windows
```

<br/>

## 🔄 How It Works

<div align="center">

```
Add Repo  →  Create Workspace  →  Launch Agent  →  Monitor  →  Review  →  Ship PR
```

</div>

Each workspace is an isolated git worktree. Agents can't step on each other. When you're happy with the changes, create a PR directly from Caspian.

<br/>

## 🏗️ Architecture

<div align="center">

| Layer | Tech | Responsibilities |
|:------|:-----|:-----------------|
| **Renderer** | React 19, TypeScript, Tailwind v4 | Dashboard, terminal streaming, diff viewer |
| **IPC** | tRPC | Type-safe communication |
| **Main** | Electron, Node.js | Git orchestration, terminal daemon, SQLite |

</div>

<br/>

## 🛠️ Tech Stack

<div align="center">

![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![tRPC](https://img.shields.io/badge/tRPC-2596BE?logo=trpc&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?logo=drizzle&logoColor=black)

</div>

<br/>

## 🗺️ Roadmap

- [ ] Custom workflow templates
- [ ] Team sync & collaboration
- [ ] Agent performance metrics
- [ ] Plugin system

<br/>

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

<br/>

## 💬 FAQ

<details>
<summary><b>What AI agents does Caspian support?</b></summary>
<br/>
Any terminal-based agent: Claude Code, Codex CLI, OpenCode, Aider, etc. If it runs in a terminal, it works.
</details>

<details>
<summary><b>How is this different from just using tmux?</b></summary>
<br/>
Caspian provides git worktree isolation (agents can't conflict), a visual dashboard, persistent sessions across restarts, and one-click PR creation. Tmux gives you panes; Caspian gives you a control plane.
</details>

<details>
<summary><b>Does it work offline?</b></summary>
<br/>
Yes. Caspian runs entirely locally. Your code never leaves your machine.
</details>

<br/>

## 📄 License

[MIT](LICENSE) — do whatever you want.

<br/>

<div align="center">

<a href="https://github.com/Alchemishty/SuperCaspian">GitHub</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://github.com/Alchemishty/SuperCaspian/issues">Issues</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://github.com/Alchemishty/SuperCaspian/discussions">Discussions</a>

<br/>
<br/>

**If Caspian helps you ship faster, give it a ⭐**

</div>
