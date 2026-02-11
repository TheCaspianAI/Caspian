import { existsSync } from "node:fs";

export interface RepositoryHealthCheck {
	healthy: boolean;
	reason?: "path_missing";
}

export function checkRepositoryHealth({
	mainRepoPath,
}: {
	mainRepoPath: string;
}): RepositoryHealthCheck {
	if (!existsSync(mainRepoPath)) {
		return { healthy: false, reason: "path_missing" };
	}
	return { healthy: true };
}

export function checkAllRepositoriesHealth(
	repos: Array<{ id: string; mainRepoPath: string }>,
): Map<string, RepositoryHealthCheck> {
	const results = new Map<string, RepositoryHealthCheck>();
	for (const repo of repos) {
		results.set(repo.id, checkRepositoryHealth({ mainRepoPath: repo.mainRepoPath }));
	}
	return results;
}
