import type { BranchPrefixMode, SelectRepository } from "lib/local-db";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { Input } from "ui/components/ui/input";
import { Label } from "ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "ui/components/ui/select";
import { cn } from "ui/lib/utils";
import { ScriptsEditor } from "../../repository/$repositoryId/components/RepositorySettings/components/ScriptsEditor";
import { BRANCH_PREFIX_MODE_LABELS } from "../../utils/branch-prefix";
import { ClickablePath } from "../ClickablePath";

interface RepositoryAccordionItemProps {
	repository: SelectRepository;
	isExpanded: boolean;
	onToggle: () => void;
}

export function RepositoryAccordionItem({
	repository,
	isExpanded,
	onToggle,
}: RepositoryAccordionItemProps) {
	const utils = electronTrpc.useUtils();

	// Local state for editing
	const [name, setName] = useState(repository.name);
	const [branchPrefixMode, setBranchPrefixMode] = useState<BranchPrefixMode>(
		repository.branchPrefixMode ?? "none",
	);
	const [branchPrefixCustom, setBranchPrefixCustom] = useState(repository.branchPrefixCustom ?? "");

	// Sync with server data
	useEffect(() => {
		setName(repository.name);
		setBranchPrefixMode(repository.branchPrefixMode ?? "none");
		setBranchPrefixCustom(repository.branchPrefixCustom ?? "");
	}, [repository]);

	const updateRepository = electronTrpc.repositories.update.useMutation({
		onSettled: () => {
			utils.repositories.getRecents.invalidate();
		},
	});

	const handleNameBlur = () => {
		if (name !== repository.name) {
			updateRepository.mutate({ id: repository.id, patch: { name } });
		}
	};

	const handleBranchPrefixModeChange = (mode: BranchPrefixMode) => {
		setBranchPrefixMode(mode);
		updateRepository.mutate({
			id: repository.id,
			patch: {
				branchPrefixMode: mode,
				branchPrefixCustom: mode === "custom" ? branchPrefixCustom : null,
			},
		});
	};

	const handleBranchPrefixCustomBlur = () => {
		if (branchPrefixCustom !== repository.branchPrefixCustom) {
			updateRepository.mutate({
				id: repository.id,
				patch: { branchPrefixCustom: branchPrefixCustom || null },
			});
		}
	};

	return (
		<div className="border-b border-border last:border-b-0">
			{/* Collapsed row */}
			<button
				type="button"
				onClick={onToggle}
				className={cn(
					"w-full flex items-center gap-3 px-4 py-3 text-left",
					"hover:bg-accent/30 transition-colors",
					isExpanded && "bg-accent/20",
				)}
			>
				<ChevronRight
					className={cn(
						"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
						isExpanded && "rotate-90",
					)}
				/>
				<span className="font-medium text-sm flex-1 truncate">{repository.name}</span>
				<span className="text-xs text-muted-foreground truncate max-w-[300px]">
					{repository.mainRepoPath}
				</span>
			</button>

			{/* Expanded content */}
			{isExpanded && (
				<div className="px-4 pb-4 pt-2 pl-11 space-y-4 bg-accent/10">
					{/* Repository Name */}
					<div className="grid grid-cols-[140px_1fr] items-center gap-4">
						<Label className="text-sm text-muted-foreground">Repository Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							onBlur={handleNameBlur}
							className="max-w-sm"
						/>
					</div>

					{/* Repository Path */}
					<div className="grid grid-cols-[140px_1fr] items-center gap-4">
						<Label className="text-sm text-muted-foreground">Repository Path</Label>
						<ClickablePath path={repository.mainRepoPath} className="text-xs" />
					</div>

					{/* Branch Prefix */}
					<div className="grid grid-cols-[140px_1fr] items-center gap-4">
						<Label className="text-sm text-muted-foreground">Branch Prefix</Label>
						<div className="flex items-center gap-2">
							<Select
								value={branchPrefixMode}
								onValueChange={(v) => handleBranchPrefixModeChange(v as BranchPrefixMode)}
							>
								<SelectTrigger className="w-[180px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.entries(BRANCH_PREFIX_MODE_LABELS) as [BranchPrefixMode, string][]).map(
										([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
							{branchPrefixMode === "custom" && (
								<Input
									placeholder="prefix"
									value={branchPrefixCustom}
									onChange={(e) => setBranchPrefixCustom(e.target.value)}
									onBlur={handleBranchPrefixCustomBlur}
									className="w-[120px]"
								/>
							)}
						</div>
					</div>

					{/* Scripts Editor */}
					<div className="pt-4 border-t border-border">
						<ScriptsEditor repositoryId={repository.id} repositoryName={repository.name} />
					</div>
				</div>
			)}
		</div>
	);
}
