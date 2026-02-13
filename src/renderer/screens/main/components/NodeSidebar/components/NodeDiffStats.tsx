import { electronTrpc } from "renderer/lib/electron-trpc";

interface NodeDiffStatsProps {
	nodeId: string;
}

export function NodeDiffStats({ nodeId }: NodeDiffStatsProps) {
	const { data } = electronTrpc.nodes.getWorktreeInfo.useQuery({ nodeId }, { staleTime: 30_000 });

	const pr = data?.githubStatus?.pr;
	if (!pr || (pr.additions === 0 && pr.deletions === 0)) {
		return null;
	}

	return (
		<span className="flex items-center gap-1 text-[10px] font-mono tabular-nums shrink-0">
			{pr.additions > 0 && <span className="text-emerald-500/90">+{pr.additions}</span>}
			{pr.deletions > 0 && <span className="text-red-400/90">&minus;{pr.deletions}</span>}
		</span>
	);
}
