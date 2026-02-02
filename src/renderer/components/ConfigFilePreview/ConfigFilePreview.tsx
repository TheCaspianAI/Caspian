import { Button } from "ui/components/ui/button";
import { cn } from "ui/lib/utils";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { OpenInButton } from "renderer/components/OpenInButton";
import { electronTrpc } from "renderer/lib/electron-trpc";
import {
	CONFIG_FILE_NAME,
	CONFIG_TEMPLATE,
	EXTERNAL_LINKS,
	REPOSITORY_CASPIAN_DIR_NAME,
} from "shared/constants";

export interface ConfigFilePreviewProps {
	repositoryId: string;
	repositoryName: string;
	configFilePath?: string;
	className?: string;
}

export function ConfigFilePreview({
	repositoryId,
	repositoryName,
	configFilePath,
	className,
}: ConfigFilePreviewProps) {
	const { data: configData } = electronTrpc.config.getConfigContent.useQuery(
		{ repositoryId },
		{ enabled: !!repositoryId },
	);

	const handleLearnMore = () => {
		window.open(EXTERNAL_LINKS.SETUP_TEARDOWN_SCRIPTS, "_blank");
	};

	const displayContent =
		configData?.exists && configData.content
			? configData.content
			: CONFIG_TEMPLATE;

	return (
		<>
			<div
				className={cn(
					"rounded-lg border border-border bg-card overflow-hidden",
					className,
				)}
			>
				<div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border">
					<span className="text-sm text-muted-foreground font-mono truncate">
						{repositoryName}/{REPOSITORY_CASPIAN_DIR_NAME}/{CONFIG_FILE_NAME}
					</span>
					<OpenInButton path={configFilePath} label={CONFIG_FILE_NAME} />
				</div>

				<div className="p-4 bg-background/50">
					<pre className="text-sm font-mono text-foreground leading-relaxed whitespace-pre-wrap">
						{displayContent}
					</pre>
				</div>
			</div>

			<div className="mt-4">
				<Button
					variant="outline"
					size="sm"
					onClick={handleLearnMore}
					className="gap-2"
				>
					Learn how to use scripts
					<HiArrowTopRightOnSquare className="h-4 w-4" />
				</Button>
			</div>
		</>
	);
}
