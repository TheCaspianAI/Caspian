import { existsSync } from "node:fs";
import { worktrees } from "lib/local-db";
import { localDb } from "main/lib/local-db";

const cache = new Map<string, boolean>();

function sweep(): void {
	const allWorktrees = localDb.select({ path: worktrees.path }).from(worktrees).all();
	cache.clear();
	for (const wt of allWorktrees) {
		cache.set(wt.path, existsSync(wt.path));
	}
}

export function initWorktreePathCache(): void {
	sweep();
}

export function checkWorktreePathExists({ path }: { path: string }): boolean {
	const cached = cache.get(path);
	if (cached !== undefined) return cached;
	const exists = existsSync(path);
	cache.set(path, exists);
	return exists;
}

export function refreshWorktreePathEntry({ path }: { path: string }): boolean {
	const exists = existsSync(path);
	cache.set(path, exists);
	return exists;
}

export function invalidateWorktreePathCache(): void {
	sweep();
}
