import { useParams } from "@tanstack/react-router";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { OpenInMenuButton } from "./components/OpenInMenuButton";
import { AppMenu } from "./components/AppMenu";
import { SidebarToggle } from "./components/SidebarToggle";
import { WindowControls } from "./components/WindowControls";

export function TopBar() {
	const { data: platform } = electronTrpc.window.getPlatform.useQuery();
	const { workspaceId } = useParams({ strict: false });
	const { data: workspace } = electronTrpc.workspaces.get.useQuery(
		{ id: workspaceId ?? "" },
		{ enabled: !!workspaceId },
	);
	// Default to Mac layout while loading to avoid overlap with traffic lights
	const isMac = platform === undefined || platform === "darwin";

	return (
		<div className="drag w-full px-3 pt-2 pb-1">
			<div className="glass-panel h-11 w-full flex items-center justify-between rounded-xl relative">
				{/* Pink accent line at bottom */}
				<div className="absolute bottom-0 left-4 right-4 h-px neon-line opacity-50" />

				<div
					className="no-drag flex items-center gap-2 h-full"
					style={{
						paddingLeft: isMac ? "76px" : "12px",
					}}
				>
					<SidebarToggle />
				</div>

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
