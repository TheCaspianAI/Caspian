import { useParams } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { OpenInMenuButton } from "./components/OpenInMenuButton";
import { AppMenu } from "./components/AppMenu";
import { WindowControls } from "./components/WindowControls";

export function TopBar() {
	const { data: platform } = electronTrpc.window.getPlatform.useQuery();
	const { workspaceId } = useParams({ strict: false });
	const { data: workspace } = electronTrpc.nodes.get.useQuery(
		{ id: workspaceId ?? "" },
		{ enabled: !!workspaceId },
	);
	// Default to Mac layout while loading to avoid overlap with traffic lights
	const isMac = platform === undefined || platform === "darwin";

	return (
		<div className="drag w-full px-3 pt-1.5 pb-1">
			<div className="glass h-9 w-full flex items-center justify-between rounded-lg">
				{/* Spacer for Mac traffic lights */}
				<div style={{ width: isMac ? "62px" : "10px" }} />

				<div className="flex-1" />

				<div className="no-drag flex items-center gap-2 h-full pr-3 shrink-0">
					{workspace?.worktreePath && (
						<OpenInMenuButton
							worktreePath={workspace.worktreePath}
							branch={workspace.worktree?.branch}
						/>
					)}
					<AppMenu />
					{!isMac && <WindowControls />}
				</div>
			</div>
		</div>
	);
}
