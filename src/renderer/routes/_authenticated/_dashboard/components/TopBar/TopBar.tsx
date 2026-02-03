import { useParams } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { OpenInMenuButton } from "./components/OpenInMenuButton";
import { AppMenu } from "./components/AppMenu";
import { WindowControls } from "./components/WindowControls";

export function TopBar() {
	const { data: platform } = electronTrpc.window.getPlatform.useQuery();
	const { nodeId } = useParams({ strict: false });
	const { data: workspace } = electronTrpc.nodes.get.useQuery(
		{ id: nodeId ?? "" },
		{ enabled: !!nodeId },
	);
	// Default to Mac layout while loading to avoid overlap with traffic lights
	const isMac = platform === undefined || platform === "darwin";

	return (
		<div className="drag h-9 w-full flex items-end justify-between">
			{/* Spacer for Mac traffic lights */}
			<div style={{ width: isMac ? "72px" : "16px" }} />

			<div className="flex-1" />

			<div className="no-drag flex items-end gap-2 pr-3 shrink-0">
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
	);
}
