# Testing Guide

This document describes how to write and run tests in the Caspian codebase. It is the single source of truth for agents and contributors working with the test infrastructure.

## Commands

```bash
bun test src/                          # Unit tests only
bun test --cwd tests/integration       # Integration tests only
bun run test:e2e                       # E2E tests only (requires compiled app)
bun run test:all                       # Unit + integration + E2E (requires compiled app)
```

CI runs lint, typecheck, and unit tests on every push to `main` and on pull requests. Integration and E2E tests run locally before creating a PR.

## What Is Committed

The test infrastructure is modular: shared fixtures, helpers, config, and seed utilities are committed and versioned. Feature-specific test files are gitignored and treated as ephemeral — any agent can recreate them at any time by following this guide and referencing the committed patterns.

| Path | Committed | Purpose |
|------|-----------|---------|
| `test-setup.ts` | Yes | Unit test global setup (mocks browser globals, Electron APIs) |
| `src/**/*.test.ts` | Yes | Unit tests — co-located with source, run in CI |
| `tests/integration/helpers/` | Yes | Seed helpers, test-db, trpc-caller, setup mocks |
| `tests/integration/bunfig.toml` | Yes | Bun config for integration test runner |
| `tests/integration/*.test.ts` | **No** (gitignored) | Feature-specific integration tests — generated per branch |
| `tests/e2e/fixtures/` | Yes | Playwright Electron fixture |
| `playwright.config.ts` | Yes | Playwright configuration |
| `tests/e2e/*.e2e.ts` | **No** (gitignored) | Feature-specific E2E tests — generated per branch |
| `tests/e2e/screenshots/` | **No** (gitignored) | Local screenshot artifacts |
| `test-results/` | **No** (gitignored) | Playwright test results |
| `playwright-report/` | **No** (gitignored) | Playwright HTML reports |

To write tests on any branch: read the committed helpers and patterns in this file, then generate feature-specific test files locally. Use `/create-tests` to automate this.

## Test Tiers

Caspian has three tiers of tests, each with different scope and infrastructure.

### Unit Tests

Unit tests live alongside source code as `*.test.ts` files in `src/`. They test pure functions, utilities, parsers, and anything that does not need a database or Electron APIs.

**When to write a unit test:** The code is a pure function, a utility, a parser, or a data transformation. It takes inputs and returns outputs with no side effects.

**Runner:** Bun's built-in test runner. **Assertions:** `expect` from `bun:test`. **Setup:** `test-setup.ts` at the repo root (preloaded via `bunfig.toml`) mocks browser globals, Electron APIs, analytics, and the database so that imports don't crash.

**File placement:** Put the test file next to the source file it tests.

```
src/shared/utils/branch.ts
src/shared/utils/branch.test.ts
```

**Pattern:**

```typescript
import { describe, expect, it } from "bun:test";
import { sanitizeBranchName } from "./branch";

describe("sanitizeBranchName", () => {
  it("replaces spaces with hyphens", () => {
    expect(sanitizeBranchName("my branch")).toBe("my-branch");
  });

  it("strips leading slashes", () => {
    expect(sanitizeBranchName("/feature/foo")).toBe("feature/foo");
  });
});
```

No special setup needed beyond the preloaded `test-setup.ts`. Write focused, isolated tests. Avoid mocking — if a unit test needs mocks, it may belong in the integration tier.

### Integration Tests

Integration tests live in `tests/integration/` and test tRPC procedures against a real in-memory SQLite database. They verify that procedures read, write, and query the database correctly and return the expected shapes.

**When to write an integration test:** The code is a tRPC procedure, a database helper, or domain logic that reads/writes the database.

**Runner:** Bun's test runner with a separate `bunfig.toml` in `tests/integration/`. **Database:** In-memory SQLite via `bun:sqlite` with Drizzle ORM and real migrations applied. **Mocking:** Electron, analytics, terminal runtime, and other main-process singletons are mocked in `tests/integration/helpers/setup.ts`.

**Infrastructure files:**

| File | Purpose |
|------|---------|
| `tests/integration/helpers/test-db.ts` | Creates an in-memory SQLite database with migrations applied |
| `tests/integration/helpers/seed.ts` | Seed helpers: `seedRepository`, `seedNode`, `seedWorktree`, `setLastActiveNode` |
| `tests/integration/helpers/trpc-caller.ts` | Creates a tRPC caller that uses a test database |
| `tests/integration/helpers/setup.ts` | Mocks for Electron, terminal, and other main-process modules |

**Pattern:**

```typescript
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedNode, seedRepository } from "./helpers/seed";
import { createTestDb, type TestDb } from "./helpers/test-db";
import { createTestCaller } from "./helpers/trpc-caller";

const TEST_DIR = join(tmpdir(), `caspian-test-${Date.now()}`);

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("myProcedure", () => {
  test("returns expected data", async () => {
    const db = createTestDb();

    const repo = seedRepository(db, {
      mainRepoPath: join(TEST_DIR, "repo-1"),
      name: "test-repo",
      tabOrder: 0,
    });
    seedNode(db, {
      repositoryId: repo.id,
      type: "branch",
      branch: "main",
      name: "main",
    });

    const caller = await createTestCaller(db);
    const result = await caller.nodes.getAllGrouped();

    expect(result.length).toBeGreaterThanOrEqual(1);
    const group = result.find((g) => g.repository.id === repo.id);
    expect(group).toBeDefined();
    expect(group!.nodes).toHaveLength(1);

    db.sqlite.close();
  });
});
```

**Key rules for integration tests:**

1. Create a fresh database per test with `createTestDb()`. Do not share databases between tests.
2. Call `createTestCaller(db)` after seeding. It must be `await`ed because it dynamically imports the router after mocking `localDb`.
3. Close the database at the end of each test with `db.sqlite.close()`.
4. If a test creates files on disk, use a unique temp directory and clean it up in `afterAll`.
5. For verification beyond the tRPC response, query the raw database: `db.sqlite.query("SELECT ...").all(...)`. Note that the SQLite column name for `repositoryId` is `project_id` (legacy naming).

### E2E Tests

E2E tests use Playwright and run against a compiled Electron app. They test renderer components, user flows, and anything that requires a running Electron window. E2E tests are not in CI — run them locally before creating a PR.

**Infrastructure files:**

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration (test directory, timeouts, worker count) |
| `tests/e2e/fixtures/electron.ts` | Electron app fixture — launches the compiled app with test env vars |

**Building and running:**

```bash
# First time or after code changes: rebuild native modules and compile
bun run install:deps                   # Rebuild better-sqlite3 and node-pty for Electron
bun run compile:app                    # Build the Electron app to dist/

# Run E2E tests
npx playwright test                    # All E2E tests
npx playwright test tests/e2e/foo.e2e.ts   # Single file
npx playwright test --grep "my test"   # Single test by name
```

If the app shows native module errors (better-sqlite3, node-pty), run `bun run install:deps` to rebuild them for the current Electron version.

**Environment variables:** The fixture (`tests/e2e/fixtures/electron.ts`) sets two env vars when launching the app:

| Variable | Purpose |
|----------|---------|
| `CASPIAN_EXPOSE_TEST_DB=1` | Exposes `globalThis.__caspianTestDb` (raw SQLite handle) in the main process for seeding data via `electronApp.evaluate()` |
| `CASPIAN_E2E_TEST=1` | Skips the quit confirmation dialog and the single-instance lock so tests can run alongside a dev instance |

Both are checked at runtime via `process.env` (not replaced at build time like `NODE_ENV`).

**Fixture usage:**

```typescript
import { test, expect } from "./fixtures/electron";

test("my feature works", async ({ electronApp, window }) => {
  // electronApp: ElectronApplication — for main-process evaluation
  // window: Page — the first BrowserWindow, a Playwright Page for UI interaction
});
```

**Seeding test data:** Use `electronApp.evaluate()` to run SQL directly in the main process. The callback signature is `(_electron, arg)` where `_electron` is the Electron module and `arg` is whatever you pass as the second parameter.

```typescript
const { nodeId } = await electronApp.evaluate(
  (_electron, opts) => {
    const db = (globalThis as Record<string, unknown>).__caspianTestDb as {
      exec: (sql: string) => void;
    };
    const nodeId = globalThis.crypto.randomUUID();
    const now = Date.now();

    db.exec(`INSERT INTO projects (...) VALUES (...)`);
    db.exec(`INSERT INTO nodes (...) VALUES (...)`);

    return { nodeId };
  },
  { repoPath: "/tmp/test-repo", branchName: "main" },
);
```

**Key rules for E2E tests:**

1. Use `globalThis.crypto.randomUUID()` for IDs inside evaluate, not `require("node:crypto")`. The `require` function is not available inside `evaluate()`.
2. Navigate with hash routing: `await window.evaluate((id) => { window.location.hash = "#/node/" + id; }, nodeId)`. Do not use `window.goto()` for hash routes.
3. When seeding worktree-type nodes, always set `git_status` on the worktree row. Without it, the UI treats the node as having an incomplete init and shows the "Setup incomplete" view instead of the normal workspace or error views. Use: `JSON.stringify({ branch: "name", needsRebase: false, lastRefreshed: Date.now() })`.
4. For assertions that need time to render, use `await expect(locator).toBeVisible({ timeout: 10_000 })`.
5. Use `window.getByRole()` and `window.getByText()` for locators. Avoid CSS selectors.
6. Take screenshots for visual verification: `await window.screenshot({ path: "tests/e2e/screenshots/descriptive-name.png" })`.
7. The screenshots directory is gitignored. Screenshots are for local debugging, not committed.
8. The SQLite table for repositories is `projects` (legacy naming). The `repositoryId` column in nodes is `project_id`.
9. Each test gets a fresh app instance (the fixture launches and closes the app per test).

**Pattern:**

```typescript
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ElectronApplication } from "@playwright/test";
import { test, expect } from "./fixtures/electron";

const TEST_DIR = join(tmpdir(), `caspian-e2e-test-${Date.now()}`);

test.beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

test.afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

async function seedMyData(electronApp: ElectronApplication, opts: { name: string }) {
  return electronApp.evaluate(
    (_electron, opts) => {
      const db = (globalThis as Record<string, unknown>).__caspianTestDb as {
        exec: (sql: string) => void;
      };
      const id = globalThis.crypto.randomUUID();
      const now = Date.now();
      const gitStatus = JSON.stringify({
        branch: opts.name,
        needsRebase: false,
        lastRefreshed: now,
      });

      db.exec(
        `INSERT INTO projects (id, main_repo_path, name, color, tab_order, last_opened_at, created_at, default_branch)
         VALUES ('${id}', '/tmp/repo', 'test-repo', 'blue', 0, ${now}, ${now}, 'main')`,
      );
      // ... more inserts

      return { id };
    },
    opts,
  );
}

test.describe("my feature", () => {
  test("shows the expected view", async ({ electronApp, window }) => {
    const { id } = await seedMyData(electronApp, { name: "test" });

    await window.evaluate((id) => {
      window.location.hash = `#/node/${id}`;
    }, id);

    await expect(window.getByText("Expected heading")).toBeVisible({ timeout: 10_000 });
    await window.screenshot({ path: "tests/e2e/screenshots/my-feature.png" });
  });
});
```

## Deciding Which Tier

| Code location | What it does | Test tier |
|--------------|-------------|-----------|
| `src/shared/`, pure utilities | Transforms data, no I/O | Unit |
| `src/lib/trpc/routers/` | tRPC procedures, DB queries | Integration |
| `src/main/lib/` (pure logic) | Domain functions, parsers | Unit |
| `src/main/lib/` (side effects) | File I/O, process spawning | Integration or E2E |
| `src/renderer/` (components) | React UI components | E2E |
| `src/renderer/stores/` | Zustand stores | Unit (for pure selectors/utils) or E2E |
| Schema / migrations | Database structure | Integration |

## Writing Good Tests

**Test behavior, not implementation.** Assert on what a function returns or what side effects it produces, not on how it does it internally.

**One assertion per concept.** A test can have multiple `expect` calls, but they should all verify the same logical thing. If a test verifies two unrelated behaviors, split it.

**Name tests as sentences.** Use `it("returns null when the node is not found")` not `it("test 1")`. The test name should read as a specification.

**Cover edge cases.** Empty inputs, missing data, error paths, and boundary conditions are where bugs hide.

**Keep tests fast.** Unit tests should complete in milliseconds. Integration tests may take tens of milliseconds for database setup. E2E tests take seconds per test because they launch a full Electron app. If a test is slow, it probably belongs in a different tier.

## Mocking

Bun provides `mock.module()` for replacing entire modules. This is used in the test setup files to replace Electron, analytics, and other main-process singletons.

If you need to mock a specific module in one test file, do it at the top of the file before importing the code under test:

```typescript
import { mock } from "bun:test";

mock.module("main/lib/some-module", () => ({
  someFunction: mock(() => "mocked-value"),
}));

// Now import the code that uses some-module
import { codeUnderTest } from "lib/trpc/routers/some-router";
```

For integration tests, `createTestCaller` handles the critical mock — it replaces `main/lib/local-db` with the test database before importing the router. You do not need to mock the database yourself.

E2E tests do not use mocks. They run against the real compiled app with a real database. Test data is seeded via `electronApp.evaluate()`.

## CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs three jobs on every push to `main` and on pull requests:

1. `bun run lint` — Biome check
2. `bun run typecheck` — TypeScript strict check
3. `bun test src/` — Unit tests

All three must pass for a PR to merge. Integration and E2E tests are run locally before creating a PR — their test files are gitignored (see "What Is Committed" above).
