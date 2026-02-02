import { createFileRoute, notFound } from "@tanstack/react-router";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { NotFound } from "renderer/routes/not-found";

export const Route = createFileRoute(
	"/_authenticated/settings/node/$nodeId/",
)({
	component: NodeSettingsPage,
	notFoundComponent: NotFound,
	loader: async ({ params, context }) => {
		const queryKey = [
			["nodes", "get"],
			{ input: { id: params.nodeId }, type: "query" },
		];

		try {
			await context.queryClient.ensureQueryData({
				queryKey,
				queryFn: () =>
					electronTrpcClient.nodes.get.query({ id: params.nodeId }),
			});
		} catch (error) {
			// If node not found, throw notFound() to render 404 page
			if (error instanceof Error && error.message.includes("not found")) {
				throw notFound();
			}
			// Re-throw other errors
			throw error;
		}
	},
});

import { Input } from "ui/components/ui/input";
import { HiOutlineFolder, HiOutlinePencilSquare } from "react-icons/hi2";
import { LuGitBranch } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useWorkspaceRename } from "renderer/screens/main/hooks/useWorkspaceRename";
import { ClickablePath } from "../../components/ClickablePath";

function NodeSettingsPage() {
	const { nodeId } = Route.useParams();
	const { data: node } = electronTrpc.nodes.get.useQuery({
		id: nodeId,
	});

	const rename = useWorkspaceRename(node?.id ?? "", node?.name ?? "");

	// Node is guaranteed to exist here because loader handles 404s
	if (!node) {
		return null;
	}

	return (
		<div className="p-6 max-w-4xl w-full select-text">
			<div className="mb-8">
				<h2 className="text-xl font-semibold">{node.name}</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Node configuration and working environment
				</p>
			</div>

			<div className="space-y-6">
				<div className="space-y-2">
					<h3
						id="node-name-label"
						className="text-base font-semibold text-foreground"
					>
						Node Name
					</h3>
					{rename.isRenaming ? (
						<Input
							ref={rename.inputRef}
							variant="ghost"
							value={rename.renameValue}
							onChange={(e) => rename.setRenameValue(e.target.value)}
							onBlur={rename.submitRename}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									e.currentTarget.blur();
								} else {
									rename.handleKeyDown(e);
								}
							}}
							aria-labelledby="node-name-label"
							className="text-base"
						/>
					) : (
						<button
							type="button"
							className="group flex items-center gap-2 cursor-pointer hover:text-foreground/80 transition-colors text-left"
							onClick={rename.startRename}
						>
							<span>{node.name}</span>
							<HiOutlinePencilSquare className="h-4 w-4 opacity-0 group-hover:opacity-70 transition-opacity shrink-0" />
						</button>
					)}
				</div>

				{node.worktree && (
					<div className="space-y-2">
						<h3 className="font-semibold text-foreground flex items-center gap-2">
							<LuGitBranch className="h-4 w-4" />
							Branch
						</h3>
						<div className="flex items-center gap-3">
							<p>{node.worktree.branch}</p>
							{node.worktree.gitStatus?.needsRebase && (
								<span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full">
									Needs Rebase
								</span>
							)}
						</div>
					</div>
				)}

				<div className="space-y-2">
					<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
						<HiOutlineFolder className="h-4 w-4" />
						Working Directory
					</h3>
					<ClickablePath path={node.worktreePath} />
				</div>
			</div>
		</div>
	);
}
