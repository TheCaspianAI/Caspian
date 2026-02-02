import { REPOSITORY_COLOR_DEFAULT } from "shared/constants/repository-colors";

/**
 * Returns the default color for new repositories.
 * Repositories start with no custom color (gray border).
 */
export function getDefaultRepositoryColor(): string {
	return REPOSITORY_COLOR_DEFAULT;
}
