import type { BranchPrefixMode } from "lib/local-db";
import { Input } from "ui/components/ui/input";
import { Label } from "ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "ui/components/ui/select";
import { useEffect, useState } from "react";
import { HiOutlineCog6Tooth, HiOutlineFolder } from "react-icons/hi2";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { resolveBranchPrefix, sanitizeSegment } from "shared/utils/branch";
import { ClickablePath } from "../../../../components/ClickablePath";
import { BRANCH_PREFIX_MODE_LABELS_WITH_DEFAULT } from "../../../../utils/branch-prefix";
import { ScriptsEditor } from "./components/ScriptsEditor";

interface RepositorySettingsProps {
	repositoryId: string;
}

export function RepositorySettings({ repositoryId }: RepositorySettingsProps) {
	const utils = electronTrpc.useUtils();
	const { data: repository } = electronTrpc.repositories.get.useQuery({
		id: repositoryId,
	});
	const { data: gitAuthor } = electronTrpc.repositories.getGitAuthor.useQuery({
		id: repositoryId,
	});
	const { data: globalBranchPrefix } =
		electronTrpc.settings.getBranchPrefix.useQuery();
	const { data: gitInfo } = electronTrpc.settings.getGitInfo.useQuery();

	const [customPrefixInput, setCustomPrefixInput] = useState(
		repository?.branchPrefixCustom ?? "",
	);

	useEffect(() => {
		setCustomPrefixInput(repository?.branchPrefixCustom ?? "");
	}, [repository?.branchPrefixCustom]);

	const updateRepository = electronTrpc.repositories.update.useMutation({
		onError: (err) => {
			console.error("[repository-settings/update] Failed to update:", err);
		},
		onSettled: () => {
			utils.repositories.get.invalidate({ id: repositoryId });
		},
	});

	const handleBranchPrefixModeChange = (value: string) => {
		if (value === "default") {
			updateRepository.mutate({
				id: repositoryId,
				patch: {
					branchPrefixMode: null,
					branchPrefixCustom: customPrefixInput || null,
				},
			});
		} else {
			updateRepository.mutate({
				id: repositoryId,
				patch: {
					branchPrefixMode: value as BranchPrefixMode,
					branchPrefixCustom: customPrefixInput || null,
				},
			});
		}
	};

	const handleCustomPrefixBlur = () => {
		const sanitized = sanitizeSegment(customPrefixInput);
		setCustomPrefixInput(sanitized);
		updateRepository.mutate({
			id: repositoryId,
			patch: {
				branchPrefixMode: "custom",
				branchPrefixCustom: sanitized || null,
			},
		});
	};

	const getPreviewPrefix = (
		mode: BranchPrefixMode | "default",
	): string | null => {
		if (mode === "default") {
			return getPreviewPrefix(globalBranchPrefix?.mode ?? "none");
		}
		return (
			resolveBranchPrefix({
				mode,
				customPrefix: customPrefixInput,
				authorPrefix: gitAuthor?.prefix,
				githubUsername: gitInfo?.githubUsername,
			}) ||
			(mode === "author"
				? "author-name"
				: mode === "github"
					? "username"
					: null)
		);
	};

	if (!repository) {
		return null;
	}

	const currentMode = repository.branchPrefixMode ?? "default";
	const previewPrefix = getPreviewPrefix(currentMode);

	return (
		<div className="p-6 max-w-4xl w-full select-text">
			<div className="mb-8">
				<h2 className="text-xl font-semibold">{repository.name}</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Repository configuration and node management
				</p>
			</div>

			<div className="space-y-6">
				<div className="space-y-2">
					<h3 className="text-base font-semibold text-foreground">Repository Name</h3>
					<p>{repository.name}</p>
				</div>

				<div className="space-y-2">
					<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
						<HiOutlineFolder className="h-4 w-4" />
						Repository Path
					</h3>
					<ClickablePath path={repository.mainRepoPath} />
				</div>

				<div className="pt-4 border-t space-y-4">
					<div className="space-y-2">
						<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
							<HiOutlineCog6Tooth className="h-4 w-4" />
							Branch Prefix
						</h3>
						<p className="text-sm text-muted-foreground">
							Override the default branch prefix for new nodes in this
							repository.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="space-y-1.5">
							<Label className="text-xs text-muted-foreground">Mode</Label>
							<Select
								value={currentMode}
								onValueChange={handleBranchPrefixModeChange}
								disabled={updateRepository.isPending}
							>
								<SelectTrigger className="w-[200px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(
										Object.entries(BRANCH_PREFIX_MODE_LABELS_WITH_DEFAULT) as [
											BranchPrefixMode | "default",
											string,
										][]
									).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{currentMode === "custom" && (
							<div className="space-y-1.5">
								<Label className="text-xs text-muted-foreground">
									Custom Prefix
								</Label>
								<Input
									placeholder="Enter custom prefix"
									value={customPrefixInput}
									onChange={(e) => setCustomPrefixInput(e.target.value)}
									onBlur={handleCustomPrefixBlur}
									className="w-[200px]"
									disabled={updateRepository.isPending}
								/>
							</div>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Preview:{" "}
						<code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
							{previewPrefix ? `${previewPrefix}/branch-name` : "branch-name"}
						</code>
					</p>
				</div>

				<div className="pt-4 border-t space-y-4">
					<div className="space-y-2">
						<h3 className="text-base font-semibold text-foreground flex items-center gap-2">
							<HiOutlineCog6Tooth className="h-4 w-4" />
							Scripts
						</h3>
						<p className="text-sm text-muted-foreground">
							Configure setup and teardown scripts that run when nodes are
							created or deleted.
						</p>
					</div>
					<ScriptsEditor repositoryId={repository.id} repositoryName={repository.name} />
				</div>
			</div>
		</div>
	);
}
