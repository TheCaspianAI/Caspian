import { PROJECT_COLOR_DEFAULT } from "shared/constants/project-colors";

/**
 * Returns the default color for new repositories.
 * Repositories start with no custom color (gray border).
 */
export function getDefaultRepositoryColor(): string {
	return PROJECT_COLOR_DEFAULT;
}
