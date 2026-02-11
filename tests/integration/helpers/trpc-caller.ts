/**
 * tRPC caller factory for integration tests.
 *
 * Creates a tRPC caller that executes procedures against a real in-memory
 * SQLite database. External dependencies (Electron, analytics, terminal
 * runtime) are mocked in the setup module.
 *
 * Usage:
 *   const testDb = createTestDb();
 *   const caller = await createTestCaller(testDb);
 *   const result = await caller.nodes.getAllGrouped();
 */
import { mock } from "bun:test";
import type { TestDb } from "./test-db";

/**
 * Creates a tRPC caller backed by the provided test database.
 *
 * Must be called AFTER createTestDb() and AFTER the integration setup
 * has mocked Electron and other external dependencies.
 */
export async function createTestCaller(testDb: TestDb) {
	// Mock the local-db module to use our test database.
	// This must happen before importing the router, because the router
	// modules import localDb at the top level.
	mock.module("main/lib/local-db", () => ({
		localDb: testDb.db,
	}));

	// Dynamically import the router factory after mocking.
	// Each call gets a fresh import because bun:test's mock.module
	// affects subsequent imports.
	const { createAppRouter } = await import("lib/trpc/routers");
	const appRouter = createAppRouter(() => null);

	return appRouter.createCaller({});
}
