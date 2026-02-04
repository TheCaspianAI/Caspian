import { useMemo, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { RepositoryAccordionItem } from "./RepositoryAccordionItem";

interface RepositoriesAccordionProps {
	searchQuery?: string;
}

export function RepositoriesAccordion({ searchQuery }: RepositoriesAccordionProps) {
	const { data: repositories, isLoading } = electronTrpc.repositories.getRecents.useQuery();

	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Filter repositories by search query (match on name or path)
	const filteredRepositories = useMemo(() => {
		if (!repositories) return [];
		if (!searchQuery) return repositories;

		const q = searchQuery.toLowerCase();
		return repositories.filter(
			(repo) => repo.name.toLowerCase().includes(q) || repo.mainRepoPath.toLowerCase().includes(q),
		);
	}, [repositories, searchQuery]);

	const handleToggle = (id: string) => {
		setExpandedId((current) => (current === id ? null : id));
	};

	if (isLoading) {
		return (
			<div className="py-8 text-center text-sm text-muted-foreground">Loading repositories...</div>
		);
	}

	if (!filteredRepositories.length) {
		if (searchQuery && repositories?.length) {
			return (
				<div className="py-8 text-center text-sm text-muted-foreground">
					No repositories matching "{searchQuery}"
				</div>
			);
		}
		return (
			<div className="py-8 text-center text-sm text-muted-foreground">
				No repositories added yet. Open a repository to get started.
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-border overflow-hidden">
			{filteredRepositories.map((repository) => (
				<RepositoryAccordionItem
					key={repository.id}
					repository={repository}
					isExpanded={expandedId === repository.id}
					onToggle={() => handleToggle(repository.id)}
				/>
			))}
		</div>
	);
}
