import { cn } from "ui/lib/utils";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HiChevronDown, HiChevronRight } from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { getMatchCountBySection } from "../../utils/settings-search";

interface RepositoriesSettingsProps {
	searchQuery: string;
}

export function RepositoriesSettings({ searchQuery }: RepositoriesSettingsProps) {
	const { data: groups = [] } =
		electronTrpc.nodes.getAllGrouped.useQuery();
	const matchRoute = useMatchRoute();
	const [expandedRepositories, setExpandedRepositories] = useState<Set<string>>(
		new Set(),
	);

	// Check if repository/node sections have matches during search
	const matchCounts = useMemo(() => {
		if (!searchQuery) return null;
		return getMatchCountBySection(searchQuery);
	}, [searchQuery]);

	const hasRepositoryMatches = (matchCounts?.repository ?? 0) > 0;
	const hasNodeMatches = (matchCounts?.node ?? 0) > 0;
	const hasAnyMatches = hasRepositoryMatches || hasNodeMatches;

	const toggleRepository = (repositoryId: string) => {
		setExpandedRepositories((prev) => {
			const next = new Set(prev);
			if (next.has(repositoryId)) {
				next.delete(repositoryId);
			} else {
				next.add(repositoryId);
			}
			return next;
		});
	};

	// Hide repositories section when searching and no matches
	if (searchQuery && !hasAnyMatches) {
		return null;
	}

	if (groups.length === 0) {
		return null;
	}

	return (
		<div className="mb-4">
			<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
				Repositories
				{searchQuery && hasAnyMatches && (
					<span className="ml-2 text-xs bg-accent/50 px-1.5 py-0.5 rounded">
						{(matchCounts?.repository ?? 0) + (matchCounts?.node ?? 0)}
					</span>
				)}
			</h2>
			<nav className="flex flex-col gap-0.5">
				{groups.map((group) => {
					const isRepositoryActive = matchRoute({
						to: "/settings/repository/$repositoryId",
						params: { repositoryId: group.repository.id },
					});

					return (
						<div key={group.repository.id}>
							{/* Repository header */}
							<div
								className={cn(
									"flex items-center h-8 rounded-md transition-colors",
									isRepositoryActive
										? "bg-accent text-accent-foreground"
										: "hover:bg-accent/50",
								)}
							>
								<Link
									to="/settings/repository/$repositoryId"
									params={{ repositoryId: group.repository.id }}
									className="flex-1 flex items-center gap-2 pl-3 pr-1 h-full text-sm text-left"
								>
									<div
										className="w-2 h-2 rounded-full shrink-0"
										style={{ backgroundColor: group.repository.color }}
									/>
									<span className="flex-1 truncate font-medium">
										{group.repository.name}
									</span>
								</Link>
								<button
									type="button"
									onClick={() => toggleRepository(group.repository.id)}
									className={cn(
										"px-2 h-full flex items-center",
										isRepositoryActive
											? "text-accent-foreground"
											: "text-muted-foreground",
									)}
								>
									{expandedRepositories.has(group.repository.id) ? (
										<HiChevronDown className="h-3.5 w-3.5" />
									) : (
										<HiChevronRight className="h-3.5 w-3.5" />
									)}
								</button>
							</div>

							{/* Nodes */}
							{expandedRepositories.has(group.repository.id) && (
								<div className="ml-4 border-l border-border pl-2 mt-0.5 mb-1">
									{group.nodes.map((node) => {
										const isNodeActive = matchRoute({
											to: "/settings/node/$nodeId",
											params: { nodeId: node.id },
										});

										return (
											<Link
												key={node.id}
												to="/settings/node/$nodeId"
												params={{ nodeId: node.id }}
												className={cn(
													"flex items-center gap-2 px-2 py-1 text-sm w-full text-left rounded-md transition-colors",
													isNodeActive
														? "bg-accent text-accent-foreground"
														: "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
												)}
											>
												<span className="truncate">{node.name}</span>
											</Link>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</nav>
		</div>
	);
}
