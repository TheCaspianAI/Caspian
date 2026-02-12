import { execWithShellEnv } from "../../nodes/utils/shell-env";

export type ToolStatus = {
	git: { available: boolean };
	gh: {
		installed: boolean;
		authenticated: boolean;
		username: string | null;
	};
};

export async function checkToolStatus(): Promise<ToolStatus> {
	const [git, gh] = await Promise.all([checkGit(), checkGh()]);
	return { git, gh };
}

async function checkGit(): Promise<ToolStatus["git"]> {
	try {
		await execWithShellEnv("git", ["--version"]);
		return { available: true };
	} catch (error) {
		console.log("[settings/check-tools] git not available:", errorMessage(error));
		return { available: false };
	}
}

async function checkGh(): Promise<ToolStatus["gh"]> {
	try {
		await execWithShellEnv("gh", ["--version"]);
	} catch (error) {
		console.log("[settings/check-tools] gh not installed:", errorMessage(error));
		return { installed: false, authenticated: false, username: null };
	}

	try {
		const { stdout } = await execWithShellEnv("gh", ["api", "user", "--jq", ".login"]);
		const username = stdout.trim() || null;
		return {
			installed: true,
			authenticated: username !== null,
			username,
		};
	} catch (error) {
		console.log("[settings/check-tools] gh not authenticated:", errorMessage(error));
		return { installed: true, authenticated: false, username: null };
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
