import { isNotNull } from "drizzle-orm";
import { repositories } from "lib/local-db";
import { checkAllRepositoriesHealth } from "lib/trpc/routers/repositories/utils/health";
import { localDb } from "main/lib/local-db";

/**
 * Log-only: does not mutate data. The user decides recovery via the UI.
 */
export function validateRepositoryPaths(): void {
	const activeRepos = localDb
		.select({ id: repositories.id, mainRepoPath: repositories.mainRepoPath })
		.from(repositories)
		.where(isNotNull(repositories.tabOrder))
		.all();

	if (activeRepos.length === 0) return;

	const results = checkAllRepositoriesHealth(activeRepos);

	for (const [repoId, check] of results) {
		if (!check.healthy) {
			const repo = activeRepos.find((r) => r.id === repoId);
			console.warn(
				`[repository-health] Repository path missing: ${repo?.mainRepoPath} (id: ${repoId})`,
			);
		}
	}
}
