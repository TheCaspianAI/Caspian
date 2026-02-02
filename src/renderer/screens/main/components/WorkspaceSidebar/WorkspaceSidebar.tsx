import { useMemo } from "react";
import { useWorkspaceShortcuts } from "renderer/hooks/useWorkspaceShortcuts";
import { PortsList } from "./PortsList";
import { ProjectSection } from "./ProjectSection";
import { SidebarDropZone } from "./SidebarDropZone";
import { WorkspaceSidebarFooter } from "./WorkspaceSidebarFooter";
import { WorkspaceSidebarHeader } from "./WorkspaceSidebarHeader";

interface WorkspaceSidebarProps {
	isCollapsed?: boolean;
}

export function WorkspaceSidebar({
	isCollapsed = false,
}: WorkspaceSidebarProps) {
	const { groups } = useWorkspaceShortcuts();

	// Calculate shortcut base indices for each project group using cumulative offsets
	const projectShortcutIndices = useMemo(
		() =>
			groups.reduce<{ indices: number[]; cumulative: number }>(
				(acc, group) => ({
					indices: [...acc.indices, acc.cumulative],
					cumulative: acc.cumulative + group.workspaces.length,
				}),
				{ indices: [], cumulative: 0 },
			).indices,
		[groups],
	);

	return (
		<SidebarDropZone className="flex flex-col h-full glass rounded-xl overflow-hidden">
			<WorkspaceSidebarHeader isCollapsed={isCollapsed} />

			<div className="flex-1 overflow-y-auto hide-scrollbar fade-mask-y">
				{groups.map((group, index) => (
					<ProjectSection
						key={group.project.id}
						projectId={group.project.id}
						projectName={group.project.name}
						projectColor={group.project.color}
						githubOwner={group.project.githubOwner}
						mainRepoPath={group.project.mainRepoPath}
						workspaces={group.workspaces}
						shortcutBaseIndex={projectShortcutIndices[index]}
						index={index}
						isCollapsed={isCollapsed}
					/>
				))}

				{groups.length === 0 && !isCollapsed && (
					<div className="flex flex-col items-center justify-center py-8 px-4">
						<div className="relative mb-4">
							{/* Decorative ring */}
							<div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" />
							<div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
								<svg
									className="w-5 h-5 text-primary/60"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
									/>
								</svg>
							</div>
						</div>
						<span className="text-sm font-medium text-foreground/80 mb-1">
							No workspaces yet
						</span>
						<span className="text-xs text-muted-foreground/60 text-center leading-relaxed max-w-[180px]">
							Open a project or drag a Git repository here to get started
						</span>
					</div>
				)}
			</div>

			{!isCollapsed && <PortsList />}

			<WorkspaceSidebarFooter isCollapsed={isCollapsed} />
		</SidebarDropZone>
	);
}
