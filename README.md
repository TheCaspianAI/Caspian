# Caspian

**The control plane for AI-generated code changes.**

Caspian prevents context collapse and silent regressions when AI agents write production code. It gives you visibility and control over what your AI coding assistants are doing—before those changes hit your codebase.

![Caspian Screenshot](https://github.com/TheCaspianAI/Caspian/raw/main/public/screenshot.png)

## The Problem

AI coding assistants are powerful, but they operate in isolation. When an agent makes changes across multiple files, you lose track of:
- What changed and why
- Whether changes conflict with other work
- If the agent broke something elsewhere in the codebase

By the time you notice, the damage is done.

## The Solution

Caspian creates isolated workspaces for each AI task using git worktrees. Every change is tracked, reviewable, and reversible. You stay in control while your agents do the heavy lifting.

### Key Features

- **Isolated Workspaces** — Each task runs in its own git worktree, preventing cross-contamination
- **Real-time Monitoring** — Watch your AI agents work with live streaming of their actions
- **Change Review** — Review diffs and file changes before merging anything
- **Multi-Agent Support** — Run multiple agents in parallel on different tasks
- **PR Integration** — Create pull requests directly from completed work
- **Works with Claude Code** — Native integration with Anthropic's Claude Code CLI

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.77+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (for AI agent functionality)

### Installation

```bash
# Clone the repository
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev
```

### Building for Production

```bash
npm run tauri:build
```

The built application will be in `src-tauri/target/release/bundle/`.

## How It Works

1. **Add a Repository** — Point Caspian at any git repository
2. **Create a Node** — Each node is an isolated workspace for a specific task
3. **Start an Agent** — Launch Claude Code in the isolated worktree
4. **Monitor Progress** — Watch the agent's actions in real-time
5. **Review & Merge** — Review changes and create a PR when ready

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Caspian App                         │
├─────────────────────────────────────────────────────────┤
│  React + TypeScript Frontend                            │
│  ├── Chat Interface (real-time agent streaming)         │
│  ├── Grid View (multi-agent monitoring)                 │
│  ├── Review Mode (diff viewing)                         │
│  └── Zustand State Management                           │
├─────────────────────────────────────────────────────────┤
│  Rust + Tauri Backend                                   │
│  ├── Git Operations (libgit2)                           │
│  ├── Worktree Management                                │
│  ├── Agent Process Control                              │
│  ├── File Watching (notify)                             │
│  └── SQLite Database                                    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

**Frontend:**
- React 19 with TypeScript
- Tailwind CSS
- Zustand for state management
- Vite for bundling

**Backend:**
- Rust with Tauri 2
- SQLite (rusqlite)
- libgit2 for git operations
- Tokio async runtime

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Install dependencies
npm install

# Run the development server
npm run tauri:dev

# Run linting
npm run lint

# Build for production
npm run tauri:build
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Website](https://caspian.ai)
- [Documentation](https://docs.caspian.ai)
- [Discord Community](https://discord.gg/caspian)
- [Twitter](https://twitter.com/CaspianAI)

---

Built with care by the Caspian team.
