import { cn } from "ui/lib/utils";
import { useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { REPOSITORY_COLOR_DEFAULT } from "shared/constants/repository-colors";

interface RepositoryThumbnailProps {
	repositoryId: string;
	repositoryName: string;
	repositoryColor: string;
	githubOwner: string | null;
	className?: string;
}

function getGitHubAvatarUrl(owner: string): string {
	return `https://github.com/${owner}.png?size=64`;
}

/**
 * Converts a hex color to rgba with the specified alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Checks if a color value is a custom hex color (not the "default" value).
 */
function isCustomColor(color: string): boolean {
	return color !== REPOSITORY_COLOR_DEFAULT && color.startsWith("#");
}

export function RepositoryThumbnail({
	repositoryId,
	repositoryName,
	repositoryColor,
	githubOwner,
	className,
}: RepositoryThumbnailProps) {
	const [imageError, setImageError] = useState(false);

	const { data: avatarData } = electronTrpc.repositories.getGitHubAvatar.useQuery(
		{ id: repositoryId },
		{
			staleTime: 1000 * 60 * 5,
			refetchOnWindowFocus: false,
		},
	);

	const owner = avatarData?.owner ?? githubOwner;
	const firstLetter = repositoryName.charAt(0).toUpperCase();
	const hasCustomColor = isCustomColor(repositoryColor);

	// Border: gray by default, custom color with slight transparency when set
	const borderClasses = cn(
		"border-[1.5px]",
		hasCustomColor ? undefined : "border-border",
	);
	const borderStyle = hasCustomColor
		? { borderColor: hexToRgba(repositoryColor, 0.6) }
		: undefined;

	// Show GitHub avatar if available
	if (owner && !imageError) {
		return (
			<div
				className={cn(
					"relative size-6 rounded overflow-hidden flex-shrink-0 bg-muted",
					borderClasses,
					className,
				)}
				style={borderStyle}
			>
				<img
					src={getGitHubAvatarUrl(owner)}
					alt={`${repositoryName} avatar`}
					className="size-full object-cover"
					onError={() => setImageError(true)}
				/>
			</div>
		);
	}

	// Fallback: show first letter
	return (
		<div
			className={cn(
				"size-6 rounded flex items-center justify-center flex-shrink-0",
				"bg-muted text-muted-foreground text-xs font-medium",
				borderClasses,
				className,
			)}
			style={borderStyle}
		>
			{firstLetter}
		</div>
	);
}
