# Caspian Development Guide

Guidelines for agents and developers working in this codebase.

## What is Caspian?

Caspian is an Electron desktop app for managing multiple git worktrees and development environments simultaneously. Each "node" represents an isolated workspace (branch or worktree) with its own terminal sessions, file editors, and state.

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun |
| Desktop | Electron + React |
| Build | electron-vite |
| State | Zustand |
| IPC | tRPC (trpc-electron) |
| UI | TailwindCSS v4 + shadcn/ui |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Linting | Biome |

## Commands

```bash
bun dev           # Start development
bun test          # Run tests
bun run build     # Production build
bun run lint      # Check lint issues
bun run lint:fix  # Auto-fix lint
bun run typecheck # Type check
```

---

## Process Architecture

**The most important constraint in this codebase:**

```
┌─────────────────────────────────────────────────────────────┐
│  MAIN PROCESS (src/main/)                                   │
│  ✓ Node.js modules (fs, path, child_process, etc.)          │
│  ✓ Database access, git operations, file I/O                │
└─────────────────────┬───────────────────────────────────────┘
                      │ tRPC over IPC
┌─────────────────────▼───────────────────────────────────────┐
│  RENDERER PROCESS (src/renderer/)                           │
│  ✗ NO Node.js modules - browser environment only            │
│  ✓ React UI, Zustand stores, user interactions              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SHARED CODE (src/shared/, src/lib/)                        │
│  ✗ NO Node.js modules - bundled for both processes          │
│  ✓ Types, constants, pure utilities                         │
└─────────────────────────────────────────────────────────────┘
```

**If you import a Node.js module in renderer or shared code, the app will crash at runtime.**

Need Node.js functionality in the UI? Add a tRPC procedure in main and call it from renderer.

---

## Core Concepts

### Repository → Worktree → Node

```
Repository (project)
├── Worktree: main branch (physical directory)
│   └── Node: "main" workspace
├── Worktree: feature-x (physical directory)
│   └── Node: "feature-x" workspace
└── Node: "quick-fix" (branch-only, no worktree)
```

- **Repository**: A git repo the user has opened
- **Worktree**: A git worktree (physical checkout of a branch)
- **Node**: An active workspace in Caspian's UI — can be backed by a worktree or just reference a branch

### Tabs and Panes

Each node has tabs. Each tab has panes (split views). Panes contain terminals or file editors.

```
Node (workspace)
├── Tab 1
│   ├── Pane A (terminal)
│   └── Pane B (file editor)
└── Tab 2
    └── Pane C (terminal)
```

State lives in `src/renderer/stores/tabs/store.ts`.

---

## Project Structure

```
src/
├── main/                     # Main process (Node.js OK)
│   ├── lib/
│   │   ├── terminal/         # Terminal daemon management
│   │   ├── terminal-host/    # PTY daemon client
│   │   ├── node-runtime/     # Runtime abstraction layer
│   │   ├── node-init-manager.ts
│   │   └── local-db/         # SQLite initialization
│   ├── windows/main.ts       # Main window creation
│   └── index.ts              # Entry point
│
├── renderer/                 # Renderer process (browser only)
│   ├── components/           # Shared React components
│   ├── screens/main/         # Main app screen
│   ├── routes/               # TanStack Router pages
│   ├── stores/               # Zustand stores
│   ├── react-query/          # tRPC hook wrappers
│   └── lib/                  # Renderer utilities
│
├── lib/                      # Shared libraries
│   ├── trpc/routers/         # tRPC procedure definitions
│   └── local-db/schema/      # Drizzle schema
│
├── shared/                   # Types and constants (NO Node.js)
│   ├── types/
│   └── constants.ts
│
├── ui/                       # UI component library
│   └── components/ui/        # shadcn components (kebab-case)
│
├── preload/                  # Electron preload scripts
└── resources/                # Static assets, migrations
```

---

## Design Principles

These principles guide architectural decisions. Follow them to keep the codebase maintainable.

### Separation of Concerns

**Separate by ownership and lifecycle.** Transport (routes, IPC handlers), orchestration (tRPC procedures), and domain logic belong in distinct layers. A tRPC procedure should validate input, call domain functions, and return results — not contain business logic itself.

**Co-locate by lifecycle, not by type.** Feature-specific code lives together. Don't split a feature across `/utils`, `/hooks`, `/components` directories — keep related code in one place.

**Boundary layers own error handling.** Domain utilities return data or throw specific errors. Only boundary code (tRPC procedures, React error boundaries) should catch and transform errors for consumers.

### Minimal Coupling

**Keep modules self-contained with narrow public APIs.** Each module should do one thing well and expose only what's necessary.

**Apply the Law of Demeter.** Depend on direct collaborators, not transitive globals. If a function needs data from deep inside another module's internals, that's a sign the API needs rethinking.

**Prefer dependency injection over singletons.** Pass `logger`, `db`, or other services as parameters rather than importing global instances. This makes testing easier and dependencies explicit.

### Fail-Safe by Default

**Validate at boundaries.** All tRPC inputs go through Zod schemas. User input, external API responses, and file contents are untrusted until validated.

**Treat external data as hostile.** API responses may have missing fields, unexpected shapes, or malicious content. Handle these cases explicitly rather than assuming happy paths.

**Never swallow errors silently.** A `catch(() => {})` or `catch(e) { return null }` hides bugs. At minimum, log errors with context so problems surface during debugging.

### Avoid Premature Abstraction

**Start with the simplest correct solution.** Don't build for hypothetical future requirements.

**Use the "three instances" heuristic.** Don't abstract until you've seen the same pattern three times. Two similar code blocks are fine — premature DRY creates the wrong abstractions.

**Don't introduce frameworks for one-off cases.** If you need to parse one date string, use a function. Don't add a date library. If you need one config file, use JSON. Don't build a config system.

---

## tRPC IPC

All communication between main and renderer uses tRPC.

### Adding a Procedure

```typescript
// src/lib/trpc/routers/domain/my-procedure.ts
import { publicProcedure } from "../../trpc";
import { z } from "zod";

export const myProcedure = publicProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input }) => {
    // Main process code here (Node.js OK)
    return { result: "data" };
  });
```

Add to router in `src/lib/trpc/routers/domain/index.ts`, then call from renderer:

```typescript
const { data } = electronTrpc.domain.myProcedure.useQuery({ id: "123" });
```

### Subscriptions Must Use Observables

**trpc-electron does not support async generators.** Always use the observable pattern:

```typescript
// ✅ Correct
import { observable } from "@trpc/server/observable";

publicProcedure.subscription(() => {
  return observable<Event>((emit) => {
    const handler = (data) => emit.next(data);
    emitter.on("event", handler);
    return () => emitter.off("event", handler);
  });
});

// ❌ Wrong - will not work
publicProcedure.subscription(async function* () {
  while (true) yield await getNext();
});
```

---

## Terminal System

Caspian uses a **separate PTY daemon process** that persists terminal sessions across app restarts.

```
Renderer (Terminal.tsx)
    ↓ tRPC
Main Process (terminal router)
    ↓
Daemon Manager (daemon-manager.ts)
    ↓ UNIX socket
Terminal Host Daemon (separate process)
    ↓
PTY sessions
```

Key files:
- `src/renderer/screens/main/.../Terminal/Terminal.tsx` — UI component
- `src/lib/trpc/routers/terminal/terminal.ts` — tRPC procedures
- `src/main/lib/terminal/daemon/daemon-manager.ts` — daemon coordination
- `src/main/lib/terminal-host/client.ts` — daemon IPC client

**Don't spawn terminals directly.** Use the runtime abstraction:

```typescript
const runtime = getNodeRuntimeRegistry().getForNodeId(nodeId);
await runtime.terminal.createOrAttach({ paneId, cols, rows });
```

---

## Database

SQLite with Drizzle ORM. Schema at `src/lib/local-db/schema/schema.ts`.

### Core Tables

| Table | Purpose |
|-------|---------|
| `repositories` | Git repos opened by user |
| `worktrees` | Git worktrees within repos |
| `nodes` | Active workspaces (UI state) |
| `settings` | App-wide settings (singleton) |

### Key Patterns

- **Soft deletes**: Nodes use `deletingAt` timestamp, not hard deletes
- **Tab ordering**: `tabOrder` field determines sidebar order; NULL = hidden
- Access DB through Drizzle helpers, not raw SQL

---

## Node Initialization

When a user creates a new node, it goes through initialization steps:

```
pending → syncing → verifying → fetching → creating_worktree → copying_config → finalizing → ready
```

Progress is tracked in `NodeInitManager` (`src/main/lib/node-init-manager.ts`) and streamed to the UI via tRPC subscription.

---

## Coding Conventions

### Object Parameters

Functions with 2+ parameters take an object:

```typescript
// ✅ Good
const createNode = ({ name, repositoryId }: { name: string; repositoryId: string }) => {};

// ❌ Bad
const createNode = (name: string, repositoryId: string) => {};
```

### Error Handling

```typescript
throw new TRPCError({ code: "NOT_FOUND", message: "Node not found" });
throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid input" });
```

### Logging

```typescript
console.log("[terminal/spawn] Creating session:", sessionId);
console.error("[git/clone] Failed:", error);
```

### State Management

- Use Zustand stores in `src/renderer/stores/`
- Avoid `useEffect` — derive state instead of syncing it
- Stores auto-persist via middleware

### Imports

- Use path aliases from `tsconfig.json`
- Prefer absolute imports for cross-directory references
- Avoid barrel files (`export *`) — import from concrete files

---

## Component Structure

One folder per component:

```
ComponentName/
├── ComponentName.tsx
├── index.ts
├── components/        # Child components
├── hooks/             # Component-specific hooks
└── utils/             # Component-specific utilities
```

**Exception:** `src/ui/components/ui/` uses kebab-case single files for shadcn CLI compatibility.

---

## Code Smells

| Smell | Symptom | Fix |
|-------|---------|-----|
| Cross-layer imports | Renderer importing from `src/main/` internals | Go through tRPC |
| Magic numbers | Hardcoded `100`, `3`, `"terminal"` in logic | Extract to named constants |
| God procedures | tRPC procedure does validation + business rules + I/O | Extract domain functions; keep procedures thin |
| Silent error swallowing | `catch(() => {})` or `catch(e) { return null }` | Log errors with context |
| Deep nesting | 4+ levels of if/for/try | Early returns, extract functions |
| Boolean blindness | `doThing(true, false, true)` | Use options object with named properties |
| Barrel file abuse | `export * from "./module"` creating circular deps | Import from concrete files directly |
| Primitive obsession | Passing raw `string` for IDs everywhere | Consider branded types for critical IDs |

---

## Agent Rules

1. **Keep diffs minimal** — change only what's necessary
2. **Follow existing patterns** — consistency over preference
3. **Type safety** — avoid `any` unless justified
4. **Test the boundaries** — terminal reattach, node init, error states
5. **Don't mix processes** — main ↔ renderer goes through tRPC
