import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { repositories } from "lib/local-db";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../..";

function configExists(mainRepoPath: string): boolean {
	const configPath = join(mainRepoPath, ".caspian", "config.json");
	return existsSync(configPath);
}

const CONFIG_TEMPLATE = `{
  "setup": [],
  "teardown": []
}
`;

function getConfigPath(mainRepoPath: string): string {
	return join(mainRepoPath, ".caspian", "config.json");
}

function ensureConfigExists(mainRepoPath: string): string {
	const configPath = getConfigPath(mainRepoPath);
	const caspianDir = join(mainRepoPath, ".caspian");

	if (!existsSync(configPath)) {
		if (!existsSync(caspianDir)) {
			mkdirSync(caspianDir, { recursive: true });
		}
		writeFileSync(configPath, CONFIG_TEMPLATE, "utf-8");
	}

	return configPath;
}

export const createConfigRouter = () => {
	return router({
		shouldShowConfigToast: publicProcedure
			.input(z.object({ repositoryId: z.string() }))
			.query(({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					return false;
				}

				if (repository.configToastDismissed) {
					return false;
				}

				return !configExists(repository.mainRepoPath);
			}),

		dismissConfigToast: publicProcedure
			.input(z.object({ repositoryId: z.string() }))
			.mutation(({ input }) => {
				localDb
					.update(repositories)
					.set({ configToastDismissed: true })
					.where(eq(repositories.id, input.repositoryId))
					.run();
				return { success: true };
			}),

		getConfigFilePath: publicProcedure
			.input(z.object({ repositoryId: z.string() }))
			.query(({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					return null;
				}
				return ensureConfigExists(repository.mainRepoPath);
			}),

		getConfigContent: publicProcedure
			.input(z.object({ repositoryId: z.string() }))
			.query(({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					return { content: null, exists: false };
				}

				const configPath = getConfigPath(repository.mainRepoPath);
				if (!existsSync(configPath)) {
					return { content: null, exists: false };
				}

				try {
					const content = readFileSync(configPath, "utf-8");
					return { content, exists: true };
				} catch {
					return { content: null, exists: false };
				}
			}),

		updateConfig: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					setup: z.array(z.string()),
					teardown: z.array(z.string()),
				}),
			)
			.mutation(({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					throw new Error("Repository not found");
				}

				const configPath = ensureConfigExists(repository.mainRepoPath);

				let existingConfig: Record<string, unknown> = {};
				try {
					const existingContent = readFileSync(configPath, "utf-8");
					const parsed = JSON.parse(existingContent);
					if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
						existingConfig = parsed;
					}
				} catch {
					// If file doesn't exist or has invalid JSON, start fresh
					existingConfig = {};
				}

				const config = {
					...existingConfig,
					setup: input.setup,
					teardown: input.teardown,
				};

				try {
					writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
					return { success: true };
				} catch (error) {
					console.error("[config/updateConfig] Failed to write config:", error);
					throw new Error("Failed to save config");
				}
			}),
	});
};

export type ConfigRouter = ReturnType<typeof createConfigRouter>;
