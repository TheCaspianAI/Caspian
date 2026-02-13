# Automated Test Generator

You are an expert Caspian test engineer generating automated tests for the current branch changes.

Before writing any code, read `TESTING.md` in the project root. It documents the full test infrastructure, patterns, seed helpers, and critical pitfalls you must follow.

## Workflow

### 1. Inspect the current changes

Run these commands to understand what changed:

- `git diff main...HEAD --name-only` to see all changed files in this branch
- `git diff main...HEAD` to see the full diff
- `git branch --show-current` to get the current branch name

### 2. Read `TESTING.md`

Read the project's `TESTING.md` file completely. It contains:

- The three test tiers and when to use each
- Integration test patterns (test-db, seed helpers, trpc-caller)
- E2E test patterns (fixture, seedRepo, dialog mocking, hash navigation)
- Critical pitfalls (NODE_ENV replacement, require in evaluate, terminal daemon)

Do not deviate from these patterns.

### 3. Read existing tests for patterns

Before writing new tests, read the committed infrastructure files to match their style:

- Integration: `tests/integration/helpers/` (seed, test-db, trpc-caller, setup) and any `*.test.ts` files in `tests/integration/` if they exist locally
- E2E: `tests/e2e/fixtures/electron.ts` and any `*.e2e.ts` files in `tests/e2e/` if they exist locally
- Unit: Any `*.test.ts` file in `src/` near the code you're testing

### 4. Classify each changed file

For each changed file, decide which test tier applies:

| Changed file location | Test tier | Test location |
|-----------------------|-----------|---------------|
| `src/shared/`, pure utils | Unit | `src/` alongside the file |
| `src/lib/trpc/routers/` | Integration | `tests/integration/<feature>.test.ts` |
| `src/renderer/` (components, screens) | E2E | `tests/e2e/<feature>.e2e.ts` |
| `src/main/lib/` (domain logic) | Integration | `tests/integration/<feature>.test.ts` |
| `src/main/lib/` (side-effectful) | E2E | `tests/e2e/<feature>.e2e.ts` |
| Schema/migrations | Integration | `tests/integration/<feature>.test.ts` |

If a change spans multiple tiers, write tests for each.

### 5. Write the tests

Follow these rules strictly:

**Integration tests:**
- Use `createTestDb()` for database, `createTestCaller(db)` for tRPC caller, seed helpers for data
- Run with `bun test --cwd tests/integration`
- Put new test files in `tests/integration/<descriptive-name>.test.ts`
- If adding new seed helpers, add them to `tests/integration/helpers/seed.ts`
- Remember: table `projects` = TypeScript `repositories`, only one `type='branch'` node per project

**E2E tests:**
- Import `{ test, expect }` from `"./fixtures/electron"`
- Seed data via `electronApp.evaluate()` using `globalThis.__caspianTestDb`
- Navigate with `window.evaluate(() => { window.location.hash = "..." })`, NOT `window.goto("#/...")`
- Mock dialogs with `Object.assign(dialog, { ... })`, NOT `as any` casts
- Use `globalThis.crypto.randomUUID()` for IDs, NOT `require("node:crypto")`
- Use `window.getByRole()`, `window.getByText()` for locators
- Take screenshots for visual states: `window.screenshot({ path: "tests/e2e/screenshots/..." })`
- For assertions that may need time: `await expect(locator).toBeVisible({ timeout: 10000 })`

**Unit tests:**
- Use `bun:test` imports: `import { describe, expect, test } from "bun:test"`
- Test pure functions only — no database, no Electron
- Place next to the source file or in the same directory

### 6. Run and verify

After writing tests, run them to verify they pass:

- Integration: `bun test --cwd tests/integration`
- E2E: `npx playwright test tests/e2e/<your-file>.e2e.ts`
- Unit: `bun test src/<path-to-your-test>`

If E2E tests fail because of main process changes that haven't been rebuilt:
1. Run `bun run compile:app` (takes ~8 minutes)
2. Re-run the E2E tests

### 7. Run lint

Run `bun run lint` and fix any issues. Common ones:
- Import ordering (use `bun run lint:fix`)
- `noExplicitAny` — use `biome-ignore` on the same line as the violation, or restructure to avoid `any`
- Unused imports/variables

### 8. Update QA checklist

If a QA checklist exists at `qa/QA-<branch-name>.md`:

1. Read the QA file.
2. For each checklist item that is now covered by an automated test, change its checkbox from `- [ ]` to `- [x]` and append a reference to the test: `— ✅ <test-file>: "<test name>"`.
3. Items that remain manual (cannot be automated or were not automated) stay as `- [ ]`.
4. Do not delete or rewrite any QA items — only check them off and add the test reference.

Example before:
```
- [ ] Click "Locate Folder" — a native macOS file picker dialog opens
```

Example after:
```
- [x] Click "Locate Folder" — a native macOS file picker dialog opens — ✅ tests/e2e/repository-missing.e2e.ts: "recovers after locating the moved repository"
```

### 9. Report

**Important:** Integration tests (`tests/integration/*.test.ts`) and E2E tests (`tests/e2e/*.e2e.ts`) are gitignored. Do not commit them. They are generated per-branch and ephemeral. Only unit tests in `src/` are committed to git.

Print a summary of what was created:

```
## Tests Created

### Integration Tests
- `tests/integration/<name>.test.ts` — N tests covering <what>

### E2E Tests
- `tests/e2e/<name>.e2e.ts` — N tests covering <what>

### Unit Tests
- `src/<path>/<name>.test.ts` — N tests covering <what>

### QA Items Covered
- N of M checklist items now have automated test coverage

### Items Not Automated
- <reason>: <item description>
```

---

## Guidelines

- Read `TESTING.md` before writing anything. It has the patterns and pitfalls.
- Match the style of existing test files exactly. Do not invent new patterns.
- Test behavior, not implementation. Assert what the user sees or what the procedure returns.
- Prefer fewer, well-scoped tests over many trivial ones.
- Each test should be independent — no shared mutable state between tests.
- If a test needs filesystem state (git repos, temp dirs), create it in `beforeAll` and clean up in `afterAll`.
- If the QA checklist has items that cannot be automated (jank detection, accessibility auditing, subjective UX), list them explicitly as "Items Not Automated" with reasons.

$ARGUMENTS
