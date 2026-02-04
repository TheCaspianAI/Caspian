# Contributing

Want to hack on Caspian? Here's how to get started.

## Getting Started

```bash
git clone https://github.com/TheCaspianAI/Caspian.git
cd Caspian
bun install
bun dev
```

That's it. The app should launch in development mode.

## Making Changes

1. **Fork the repo** and create a branch for your work
2. **Make your changes** — keep commits focused and atomic
3. **Open a PR** with a clear description of what you changed and why
4. **Enable "Allow edits from maintainers"** so we can help move things along

For anything beyond small fixes, open an issue first to discuss the approach. This saves everyone time.

## Before You Submit

Run these locally:

```bash
bun run lint       # Check for lint issues
bun run typecheck  # Verify types
bun test           # Run the test suite
```

## Code Style

See [AGENTS.md](./AGENTS.md) for detailed conventions. The essentials:

- **Minimal diffs** — change only what's necessary
- **Match existing patterns** — consistency over personal preference
- **No `any` types** unless there's a good reason
- **Object params** for functions with 2+ arguments

Questions? Open an issue or start a discussion.
