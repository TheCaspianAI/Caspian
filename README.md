# Caspian

**Your AI agents are writing code. Do you know what they're doing?**

Caspian is the control plane for AI-generated code. Because "the AI did it" isn't a valid excuse in your post-mortem.

<p align="center">
  <a href="https://github.com/TheCaspianAI/Caspian/raw/main/public/demo.mp4">
    <img src="https://img.shields.io/badge/Watch%20Demo-▶%20Video-blue?style=for-the-badge&logo=youtube" alt="Watch Demo Video"/>
  </a>
</p>

---

## The Problem

You gave an AI agent access to your codebase. Bold move.

Now it's making changes across 47 files, you've lost track of what's happening, and somewhere in there it "refactored" your authentication logic. You'll find out in production.

**Context collapse is real.** When agents work in isolation:
- Changes pile up invisibly
- Conflicts multiply silently
- Regressions ship confidently

## The Fix

Caspian isolates every AI task in its own git worktree. Each agent gets a sandbox. Every change is tracked. Nothing touches your main branch until you say so.

**You stay in control. Your agents stay productive. Everyone's happy.**

---

## Features

| What | Why it matters |
|------|----------------|
| **Isolated Worktrees** | Each task = its own branch + working directory. No cross-contamination. |
| **Live Monitoring** | Watch your agents work in real-time. See every file touch, every command. |
| **Diff Review** | Review all changes before they go anywhere. Spot the "helpful" refactors. |
| **Multi-Agent** | Run 5 agents on 5 tasks. In parallel. Without chaos. |
| **PR Integration** | Ship clean PRs directly from completed work. |
| **Claude Code Native** | Built for Anthropic's Claude Code CLI. First-class support. |

---

## Quick Start

### You'll need
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.77+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (for the AI part)

### Get running

```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
npm install
npm run tauri:dev
```

That's it. No 47-step setup guide.

### Build for production

```bash
npm run tauri:build
```

Find your app in `src-tauri/target/release/bundle/`

---

## How It Works

```
1. Add repo     →  Point Caspian at your project
2. Create node  →  Spin up an isolated workspace
3. Run agent    →  Let Claude Code do its thing
4. Watch        →  See everything in real-time
5. Review       →  Check the diff, approve what's good
6. Ship         →  Create a PR, merge with confidence
```

---

## Architecture

```
┌────────────────────────────────────────────────┐
│              Caspian Desktop App               │
├────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                 │
│  • Real-time chat streaming                    │
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

We welcome PRs. Check out [CONTRIBUTING.md](CONTRIBUTING.md) for the details.

```bash
npm install        # deps
npm run tauri:dev  # dev server
npm run lint       # check your work
```

---

## License

MIT. Do what you want.

---

## Links

[Website](https://caspian.ai) · [Docs](https://docs.caspian.ai) · [Discord](https://discord.gg/caspian) · [Twitter](https://twitter.com/CaspianAI)

---

**Stop hoping your AI agents are doing the right thing. Start knowing.**
