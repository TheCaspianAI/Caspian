import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "lib/local-db";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import {
	ensureCaspianHomeDirExists,
	CASPIAN_HOME_DIR,
	CASPIAN_SENSITIVE_FILE_MODE,
} from "../app-environment";

const isDev = process.env.NODE_ENV === "development";

const DB_PATH = join(CASPIAN_HOME_DIR, "local.db");

ensureCaspianHomeDirExists();

/**
 * Gets the migrations directory path.
 *
 * Path resolution strategy:
 * - Production (packaged .app): resources/migrations/
 * - Development (NODE_ENV=development): src/resources/migrations/
 * - Preview (electron-vite preview): dist/resources/migrations/
 * - Test environment: Use monorepo path relative to __dirname
 */
function getMigrationsDirectory(): string {
	// Check if running in Electron (app.getAppPath exists)
	const isElectron =
		typeof app?.getAppPath === "function" &&
		typeof app?.isPackaged === "boolean";

	if (isElectron && app.isPackaged) {
		return join(process.resourcesPath, "resources/migrations");
	}


	if (isElectron && isDev) {
		// Development: source files in local resources
		return join(app.getAppPath(), "src/resources/migrations");
	}

	// Preview mode or test: __dirname is dist/main, so go up one level to dist/resources/migrations
	const previewPath = join(__dirname, "../resources/migrations");
	if (existsSync(previewPath)) {
		return previewPath;
	}

	// Fallback: try local resources path (for tests or dev without Electron)
	const localResourcesPath = join(
		__dirname,
		"../../../../resources/migrations",
	);
	if (existsSync(localResourcesPath)) {
		return localResourcesPath;
	}

	console.warn(`[local-db] Migrations directory not found at: ${previewPath}`);
	return previewPath;
}

const migrationsFolder = getMigrationsDirectory();

const sqlite = new Database(DB_PATH);
try {
	chmodSync(DB_PATH, CASPIAN_SENSITIVE_FILE_MODE);
} catch {
	// Best-effort; directory permissions should still protect the DB.
}
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = OFF");

console.log(`[local-db] Database initialized at: ${DB_PATH}`);
console.log(`[local-db] Running migrations from: ${migrationsFolder}`);

export const localDb = drizzle(sqlite, { schema });

try {
	migrate(localDb, { migrationsFolder });
} catch (error) {
	const sqliteError = error as Error & { code?: string };
	const errorCode = sqliteError.code?.toLowerCase() ?? "";
	const errorMessage = sqliteError.message?.toLowerCase() ?? "";

	const isSqliteError = errorCode === "sqlite_error";
	const isIdempotentMessage =
		errorMessage.includes("duplicate column name") ||
		errorMessage.includes("already exists") ||
		errorMessage.includes("no such column");

	if (isSqliteError && isIdempotentMessage) {
		console.log(`[local-db] Skipped idempotent error: ${sqliteError.message}`);
	} else {
		throw error;
	}
}

console.log("[local-db] Migrations complete");

export type LocalDb = typeof localDb;
