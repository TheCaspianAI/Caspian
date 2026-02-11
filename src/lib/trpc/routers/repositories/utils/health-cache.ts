import { eq, isNotNull } from "drizzle-orm";
import { repositories } from "lib/local-db";
import { localDb } from "main/lib/local-db";
import { checkRepositoryHealth, type RepositoryHealthCheck } from "./health";

const cache = new Map<string, RepositoryHealthCheck>();

function sweep(): { total: number; missing: number } {
	const activeRepos = localDb
		.select({ id: repositories.id, mainRepoPath: repositories.mainRepoPath })
		.from(repositories)
		.where(isNotNull(repositories.tabOrder))
		.all();

	cache.clear();
	let missing = 0;
	for (const repo of activeRepos) {
		const result = checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath });
		cache.set(repo.id, result);
		if (!result.healthy) missing++;
	}
	return { total: activeRepos.length, missing };
}

export function initHealthCache(): void {
	const { total, missing } = sweep();
	console.log(`[repository-health] Cache initialized: ${total} repositories (${missing} missing)`);
}

export function getRepositoryHealth({
	repositoryId,
}: {
	repositoryId: string;
}): RepositoryHealthCheck {
	const cached = cache.get(repositoryId);
	if (cached) return cached;

	// Cache miss: new repo added since last sweep
	const repo = localDb
		.select({ mainRepoPath: repositories.mainRepoPath })
		.from(repositories)
		.where(eq(repositories.id, repositoryId))
		.get();

	if (!repo) return { healthy: true };

	const result = checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath });
	cache.set(repositoryId, result);
	return result;
}

export function invalidateRepositoryHealthCache(): void {
	sweep();
}

export function disposeHealthCache(): void {
	cache.clear();
}
