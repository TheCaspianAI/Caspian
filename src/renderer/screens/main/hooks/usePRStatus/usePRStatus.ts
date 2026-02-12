import type { GitHubStatus } from "lib/local-db";
import { electronTrpc } from "renderer/lib/electron-trpc";

interface UsePRStatusOptions {
	nodeId: string | undefined;
	enabled?: boolean;
	refetchInterval?: number;
}

interface UsePRStatusResult {
	pr: GitHubStatus["pr"] | null;
	repoUrl: string | null;
	branchExistsOnRemote: boolean;
	isLoading: boolean;
	refetch: () => void;
}

/**
 * Hook to fetch and manage GitHub PR status for a node.
 * Returns PR info, loading state, and refetch function.
 */
export function usePRStatus({
	nodeId,
	enabled = true,
	refetchInterval,
}: UsePRStatusOptions): UsePRStatusResult {
	const {
		data: githubStatusData,
		isLoading,
		refetch,
	} = electronTrpc.nodes.getGitHubStatus.useQuery(
		{ nodeId: nodeId ?? "" },
		{
			enabled: enabled && !!nodeId,
			refetchInterval,
		},
	);

	const githubStatus = githubStatusData?.status;

	return {
		pr: githubStatus?.pr ?? null,
		repoUrl: githubStatus?.repoUrl ?? null,
		branchExistsOnRemote: githubStatus?.branchExistsOnRemote ?? false,
		isLoading,
		refetch,
	};
}
