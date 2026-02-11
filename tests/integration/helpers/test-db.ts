/**
 * Test database helper for integration tests.
 *
 * Creates an in-memory SQLite database using Bun's built-in driver
 * and Drizzle ORM, then runs all migrations. This provides a real
 * database for tRPC procedure tests without needing better-sqlite3
 * native bindings (which don't work under Bun).
 */
import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import * as schema from "lib/local-db";

const MIGRATIONS_DIR = join(import.meta.dir, "../../../src/resources/migrations");

export function createTestDb() {
	const sqlite = new Database(":memory:");
	sqlite.exec("PRAGMA journal_mode = WAL");
	sqlite.exec("PRAGMA foreign_keys = OFF");

	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: MIGRATIONS_DIR });

	// Ensure the settings singleton row exists (many procedures expect it)
	sqlite.exec("INSERT OR IGNORE INTO settings (id) VALUES (1)");

	return {
		db,
		sqlite,
		[Symbol.dispose]() {
			sqlite.close();
		},
	};
}

export type TestDb = ReturnType<typeof createTestDb>;
