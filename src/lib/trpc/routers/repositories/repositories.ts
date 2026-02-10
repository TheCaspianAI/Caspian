import { existsSync, statSync } from "node:fs";
import { access } from "node:fs/promises";
import { basename, join } from "node:path";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, not } from "drizzle-orm";
import type { BrowserWindow } from "electron";
import { dialog } from "electron";
import {
	BRANCH_PREFIX_MODES,
	nodes,
	repositories,
	type SelectRepository,
	settings,
} from "lib/local-db";
import { track } from "main/lib/analytics";
import { localDb } from "main/lib/local-db";
import { getNodeRuntimeRegistry } from "main/lib/node-runtime";
import { REPOSITORY_COLOR_VALUES } from "shared/constants/repository-colors";
import simpleGit from "simple-git";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import {
	activateRepository,
	getBranchNode,
	setLastActiveNode,
	touchNode,
} from "../nodes/utils/db-helpers";
import {
	getCurrentBranch,
	getDefaultBranch,
	getGitAuthorName,
	getGitRoot,
	refreshDefaultBranch,
	sanitizeAuthorPrefix,
} from "../nodes/utils/git";
import { getDefaultRepositoryColor } from "./utils/colors";
import { fetchGitHubOwner, getGitHubAvatarUrl } from "./utils/github";

type Repository = SelectRepository;

// Return types for openNew procedure
type OpenNewCanceled = { canceled: true };
type OpenNewSuccess = { canceled: false; repository: Repository };
type OpenNewNeedsGitInit = {
	canceled: false;
	needsGitInit: true;
	selectedPath: string;
};
type OpenNewError = { canceled: false; error: string };
export type OpenNewResult = OpenNewCanceled | OpenNewSuccess | OpenNewNeedsGitInit | OpenNewError;

/**
 * Creates or updates a repository record in the database.
 * If a repository with the same mainRepoPath exists, updates lastOpenedAt.
 * Otherwise, creates a new repository.
 */
function upsertRepository(mainRepoPath: string, defaultBranch: string): Repository {
	const name = basename(mainRepoPath);

	const existing = localDb
		.select()
		.from(repositories)
		.where(eq(repositories.mainRepoPath, mainRepoPath))
		.get();

	if (existing) {
		localDb
			.update(repositories)
			.set({ lastOpenedAt: Date.now(), defaultBranch })
			.where(eq(repositories.id, existing.id))
			.run();
		return { ...existing, lastOpenedAt: Date.now(), defaultBranch };
	}

	const repository = localDb
		.insert(repositories)
		.values({
			mainRepoPath,
			name,
			color: getDefaultRepositoryColor(),
			defaultBranch,
		})
		.returning()
		.get();

	return repository;
}

/**
 * Ensures a repository has a main (branch) node.
 * If one doesn't exist, creates it automatically.
 * This is called after opening/creating a repository to provide a default node.
 */
async function ensureMainNode(repository: Repository): Promise<void> {
	const existingBranchNode = getBranchNode(repository.id);

	// If branch node already exists, just touch it and return
	if (existingBranchNode) {
		touchNode(existingBranchNode.id);
		setLastActiveNode(existingBranchNode.id);
		return;
	}

	// Get current branch from main repo
	const branch = await getCurrentBranch(repository.mainRepoPath);
	if (!branch) {
		console.warn(
			`[ensureMainNode] Could not determine current branch for repository ${repository.id}`,
		);
		return;
	}

	// Insert new branch node with conflict handling for race conditions
	// The unique partial index (repositoryId WHERE type='branch') prevents duplicates
	const insertResult = localDb
		.insert(nodes)
		.values({
			repositoryId: repository.id,
			type: "branch",
			branch,
			name: branch,
			tabOrder: 0,
		})
		.onConflictDoNothing()
		.returning()
		.all();

	const wasExisting = insertResult.length === 0;

	// Only shift existing nodes if we successfully inserted
	if (!wasExisting) {
		const newNodeId = insertResult[0].id;
		const repositoryNodes = localDb
			.select()
			.from(nodes)
			.where(
				and(
					eq(nodes.repositoryId, repository.id),
					not(eq(nodes.id, newNodeId)),
					isNull(nodes.deletingAt),
				),
			)
			.all();

		for (const node of repositoryNodes) {
			localDb
				.update(nodes)
				.set({ tabOrder: node.tabOrder + 1 })
				.where(eq(nodes.id, node.id))
				.run();
		}
	}

	// Get the node (either newly created or existing from race condition)
	const node = insertResult[0] ?? getBranchNode(repository.id);

	if (!node) {
		console.warn(
			`[ensureMainNode] Failed to create or find branch node for repository ${repository.id}`,
		);
		return;
	}

	setLastActiveNode(node.id);

	if (!wasExisting) {
		activateRepository(repository);

		track("node_opened", {
			node_id: node.id,
			repository_id: repository.id,
			type: "branch",
			was_existing: false,
			auto_created: true,
		});
	}
}

// Safe filename regex: letters, numbers, dots, underscores, hyphens, spaces, and common unicode
// Allows most valid Git repo names while avoiding path traversal characters
const SAFE_REPO_NAME_REGEX = /^[a-zA-Z0-9._\- ]+$/;

/**
 * Extracts and validates a repository name from a git URL.
 * Handles HTTP/HTTPS URLs, SSH-style URLs (git@host:user/repo), and edge cases.
 */
function extractRepoName(urlInput: string): string | null {
	// Normalize: trim whitespace and strip trailing slashes
	let normalized = urlInput.trim().replace(/\/+$/, "");

	if (!normalized) return null;

	let repoSegment: string | undefined;

	// Try parsing as HTTP/HTTPS URL first
	try {
		const parsed = new URL(normalized);
		if (parsed.protocol === "http:" || parsed.protocol === "https:") {
			// Get pathname and strip query/hash (URL constructor handles this)
			const pathname = parsed.pathname;
			repoSegment = pathname.split("/").filter(Boolean).pop();
		}
	} catch {
		// Not a valid URL, try SSH-style parsing
	}

	// Fallback to SSH-style parsing (git@github.com:user/repo.git)
	if (!repoSegment) {
		// Handle SSH format: git@host:path or just path segments
		const colonIndex = normalized.indexOf(":");
		if (colonIndex !== -1 && !normalized.includes("://")) {
			// SSH-style: take everything after the colon
			normalized = normalized.slice(colonIndex + 1);
		}
		// Split by '/' and get the last segment
		repoSegment = normalized.split("/").filter(Boolean).pop();
	}

	if (!repoSegment) return null;

	repoSegment = repoSegment.split("?")[0].split("#")[0];
	repoSegment = repoSegment.replace(/\.git$/, "");

	try {
		repoSegment = decodeURIComponent(repoSegment);
	} catch {
		// Invalid encoding, continue with raw value
	}

	repoSegment = repoSegment.trim();

	// Validate against safe filename regex
	if (!repoSegment || !SAFE_REPO_NAME_REGEX.test(repoSegment)) {
		return null;
	}

	return repoSegment;
}

export const createRepositoriesRouter = (getWindow: () => BrowserWindow | null) => {
	return router({
		get: publicProcedure.input(z.object({ id: z.string() })).query(({ input }): Repository => {
			const repository = localDb
				.select()
				.from(repositories)
				.where(eq(repositories.id, input.id))
				.get();

			if (!repository) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: `Repository ${input.id} not found`,
				});
			}

			return repository;
		}),

		getRecents: publicProcedure.query((): Repository[] => {
			return localDb.select().from(repositories).orderBy(desc(repositories.lastOpenedAt)).all();
		}),

		getBranches: publicProcedure.input(z.object({ repositoryId: z.string() })).query(
			async ({
				input,
			}): Promise<{
				branches: Array<{
					name: string;
					lastCommitDate: number;
					isLocal: boolean;
					isRemote: boolean;
				}>;
				defaultBranch: string;
				branchNodes: Record<string, { nodeId: string; nodeName: string; type: string }>;
			}> => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					throw new Error(`Repository ${input.repositoryId} not found`);
				}

				const git = simpleGit(repository.mainRepoPath);

				// Check if origin remote exists
				let hasOrigin = false;
				try {
					const remotes = await git.getRemotes();
					hasOrigin = remotes.some((r) => r.name === "origin");
				} catch {
					// If we can't get remotes, assume no origin
				}

				const branchSummary = await git.branch(["-a"]);

				const localBranchSet = new Set<string>();
				const remoteBranchSet = new Set<string>();

				for (const name of Object.keys(branchSummary.branches)) {
					if (name.startsWith("remotes/origin/")) {
						if (name === "remotes/origin/HEAD") continue;
						const remoteName = name.replace("remotes/origin/", "");
						remoteBranchSet.add(remoteName);
					} else {
						localBranchSet.add(name);
					}
				}

				// Get branch dates for sorting - fetch from both local and remote
				const branchMap = new Map<
					string,
					{ lastCommitDate: number; isLocal: boolean; isRemote: boolean }
				>();

				// First, get remote branch dates (if origin exists)
				if (hasOrigin) {
					try {
						const remoteBranchInfo = await git.raw([
							"for-each-ref",
							"--sort=-committerdate",
							"--format=%(refname:short) %(committerdate:unix)",
							"refs/remotes/origin/",
						]);

						for (const line of remoteBranchInfo.trim().split("\n")) {
							if (!line) continue;
							const lastSpaceIdx = line.lastIndexOf(" ");
							let branch = line.substring(0, lastSpaceIdx);
							const timestamp = Number.parseInt(line.substring(lastSpaceIdx + 1), 10);

							// Normalize remote branch names
							if (branch.startsWith("origin/")) {
								branch = branch.replace("origin/", "");
							}

							if (branch === "HEAD") continue;

							branchMap.set(branch, {
								lastCommitDate: timestamp * 1000,
								isLocal: localBranchSet.has(branch),
								isRemote: true,
							});
						}
					} catch {
						// Fallback for remote branches
						for (const name of remoteBranchSet) {
							branchMap.set(name, {
								lastCommitDate: 0,
								isLocal: localBranchSet.has(name),
								isRemote: true,
							});
						}
					}
				}

				// Then, add local-only branches
				try {
					const localBranchInfo = await git.raw([
						"for-each-ref",
						"--sort=-committerdate",
						"--format=%(refname:short) %(committerdate:unix)",
						"refs/heads/",
					]);

					for (const line of localBranchInfo.trim().split("\n")) {
						if (!line) continue;
						const lastSpaceIdx = line.lastIndexOf(" ");
						const branch = line.substring(0, lastSpaceIdx);
						const timestamp = Number.parseInt(line.substring(lastSpaceIdx + 1), 10);

						if (branch === "HEAD") continue;

						// Only add if not already in map (remote takes precedence for date)
						if (!branchMap.has(branch)) {
							branchMap.set(branch, {
								lastCommitDate: timestamp * 1000,
								isLocal: true,
								isRemote: remoteBranchSet.has(branch),
							});
						} else {
							// Update isLocal flag for branches that exist both locally and remotely
							const existing = branchMap.get(branch);
							if (existing) {
								existing.isLocal = true;
							}
						}
					}
				} catch {
					// Fallback for local branches
					for (const name of localBranchSet) {
						if (!branchMap.has(name)) {
							branchMap.set(name, {
								lastCommitDate: 0,
								isLocal: true,
								isRemote: remoteBranchSet.has(name),
							});
						}
					}
				}

				const branches = Array.from(branchMap.entries()).map(([name, data]) => ({
					name,
					...data,
				}));

				// Sync with remote in case the default branch changed (e.g. master -> main)
				const remoteDefaultBranch = await refreshDefaultBranch(repository.mainRepoPath);

				const defaultBranch =
					remoteDefaultBranch ||
					repository.defaultBranch ||
					(await getDefaultBranch(repository.mainRepoPath));

				if (defaultBranch !== repository.defaultBranch) {
					localDb
						.update(repositories)
						.set({ defaultBranch })
						.where(eq(repositories.id, input.repositoryId))
						.run();
				}

				// Sort: default branch first, then by date
				branches.sort((a, b) => {
					if (a.name === defaultBranch) return -1;
					if (b.name === defaultBranch) return 1;
					return b.lastCommitDate - a.lastCommitDate;
				});

				const activeNodes = localDb
					.select({ id: nodes.id, branch: nodes.branch, name: nodes.name, type: nodes.type })
					.from(nodes)
					.where(and(eq(nodes.repositoryId, input.repositoryId), isNull(nodes.deletingAt)))
					.all();

				const branchNodes: Record<string, { nodeId: string; nodeName: string; type: string }> = {};
				for (const node of activeNodes) {
					branchNodes[node.branch] = { nodeId: node.id, nodeName: node.name, type: node.type };
				}

				return { branches, defaultBranch, branchNodes };
			},
		),

		openNew: publicProcedure.mutation(async (): Promise<OpenNewResult> => {
			const window = getWindow();
			if (!window) {
				return { canceled: false, error: "No window available" };
			}
			const result = await dialog.showOpenDialog(window, {
				properties: ["openDirectory"],
				title: "Open Repository",
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { canceled: true };
			}

			const selectedPath = result.filePaths[0];

			let mainRepoPath: string;
			try {
				mainRepoPath = await getGitRoot(selectedPath);
			} catch (_error) {
				// Return a special response so the UI can offer to initialize git
				return {
					canceled: false,
					needsGitInit: true,
					selectedPath,
				};
			}

			const defaultBranch = await getDefaultBranch(mainRepoPath);
			const repository = upsertRepository(mainRepoPath, defaultBranch);

			// Auto-create main node if it doesn't exist
			await ensureMainNode(repository);

			track("repository_opened", {
				repository_id: repository.id,
				method: "open",
			});

			return {
				canceled: false,
				repository,
			};
		}),

		openFromPath: publicProcedure
			.input(z.object({ path: z.string() }))
			.mutation(async ({ input }): Promise<OpenNewResult> => {
				const selectedPath = input.path;

				// Check if path exists
				if (!existsSync(selectedPath)) {
					return { canceled: false, error: "Path does not exist" };
				}

				// Check if path is a directory
				try {
					const stats = statSync(selectedPath);
					if (!stats.isDirectory()) {
						return {
							canceled: false,
							error: "Please drop a folder, not a file",
						};
					}
				} catch {
					return {
						canceled: false,
						error: "Could not access the dropped item",
					};
				}

				let mainRepoPath: string;
				try {
					mainRepoPath = await getGitRoot(selectedPath);
				} catch (_error) {
					// Return a special response so the UI can offer to initialize git
					return {
						canceled: false,
						needsGitInit: true,
						selectedPath,
					};
				}

				const defaultBranch = await getDefaultBranch(mainRepoPath);
				const repository = upsertRepository(mainRepoPath, defaultBranch);

				// Auto-create main node if it doesn't exist
				await ensureMainNode(repository);

				track("repository_opened", {
					repository_id: repository.id,
					method: "drop",
				});

				return {
					canceled: false,
					repository,
				};
			}),

		initGitAndOpen: publicProcedure
			.input(z.object({ path: z.string() }))
			.mutation(async ({ input }) => {
				const git = simpleGit(input.path);

				// Initialize git repository with 'main' as default branch
				// Try with --initial-branch=main (Git 2.28+), fall back to plain init
				try {
					await git.init(["--initial-branch=main"]);
				} catch (err) {
					// Likely an older Git version that doesn't support --initial-branch
					console.warn("Git init with --initial-branch failed, using fallback:", err);
					await git.init();
				}

				// Create initial commit so we have a valid branch ref
				try {
					await git.raw(["commit", "--allow-empty", "-m", "Initial commit"]);
				} catch (err) {
					const errorMessage = err instanceof Error ? err.message : String(err);
					// Check for common git config issues
					if (
						errorMessage.includes("empty ident") ||
						errorMessage.includes("user.email") ||
						errorMessage.includes("user.name")
					) {
						throw new Error(
							"Git user not configured. Please run:\n" +
								'  git config --global user.name "Your Name"\n' +
								'  git config --global user.email "you@example.com"',
						);
					}
					throw new Error(`Failed to create initial commit: ${errorMessage}`);
				}

				// Get the current branch name (will be 'main' or 'master' depending on git version/config)
				const branchSummary = await git.branch();
				const defaultBranch = branchSummary.current || "main";

				const repository = upsertRepository(input.path, defaultBranch);

				// Auto-create main node if it doesn't exist
				await ensureMainNode(repository);

				track("repository_opened", {
					repository_id: repository.id,
					method: "init",
				});

				return { repository };
			}),

		cloneRepo: publicProcedure
			.input(
				z.object({
					url: z.string().url(),
					// Trim and convert empty/whitespace strings to undefined
					targetDirectory: z
						.string()
						.trim()
						.optional()
						.transform((v) => (v && v.length > 0 ? v : undefined)),
				}),
			)
			.mutation(async ({ input }) => {
				try {
					let targetDir = input.targetDirectory;

					if (!targetDir) {
						const window = getWindow();
						if (!window) {
							return {
								canceled: false as const,
								success: false as const,
								error: "No window available",
							};
						}
						const result = await dialog.showOpenDialog(window, {
							properties: ["openDirectory", "createDirectory"],
							title: "Select Clone Destination",
						});

						// User canceled - return canceled state (not an error)
						if (result.canceled || result.filePaths.length === 0) {
							return { canceled: true as const, success: false as const };
						}

						targetDir = result.filePaths[0];
					}

					const repoName = extractRepoName(input.url);
					if (!repoName) {
						return {
							canceled: false as const,
							success: false as const,
							error: "Invalid repository URL",
						};
					}

					const clonePath = join(targetDir, repoName);

					// Check if we already have a repository for this path
					const existingRepository = localDb
						.select()
						.from(repositories)
						.where(eq(repositories.mainRepoPath, clonePath))
						.get();

					if (existingRepository) {
						// Verify the filesystem path still exists
						try {
							await access(clonePath);
							// Directory exists - update lastOpenedAt and return existing repository
							localDb
								.update(repositories)
								.set({ lastOpenedAt: Date.now() })
								.where(eq(repositories.id, existingRepository.id))
								.run();

							// Auto-create main node if it doesn't exist
							await ensureMainNode({
								...existingRepository,
								lastOpenedAt: Date.now(),
							});

							track("repository_opened", {
								repository_id: existingRepository.id,
								method: "clone",
							});

							return {
								canceled: false as const,
								success: true as const,
								repository: { ...existingRepository, lastOpenedAt: Date.now() },
							};
						} catch {
							// Directory is missing - remove the stale repository record and continue with clone
							localDb.delete(repositories).where(eq(repositories.id, existingRepository.id)).run();
						}
					}

					// Check if target directory already exists (but not our repository)
					if (existsSync(clonePath)) {
						return {
							canceled: false as const,
							success: false as const,
							error: `A folder named "${repoName}" already exists at this location. Please choose a different destination.`,
						};
					}

					// Clone the repository
					const git = simpleGit();
					await git.clone(input.url, clonePath);

					// Create new repository
					const name = basename(clonePath);
					const defaultBranch = await getDefaultBranch(clonePath);
					const repository = localDb
						.insert(repositories)
						.values({
							mainRepoPath: clonePath,
							name,
							color: getDefaultRepositoryColor(),
							defaultBranch,
						})
						.returning()
						.get();

					// Auto-create main node if it doesn't exist
					await ensureMainNode(repository);

					track("repository_opened", {
						repository_id: repository.id,
						method: "clone",
					});

					return {
						canceled: false as const,
						success: true as const,
						repository,
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					return {
						canceled: false as const,
						success: false as const,
						error: `Failed to clone repository: ${errorMessage}`,
					};
				}
			}),

		update: publicProcedure
			.input(
				z.object({
					id: z.string(),
					patch: z.object({
						name: z.string().trim().min(1).optional(),
						color: z
							.string()
							.refine(
								(value) => REPOSITORY_COLOR_VALUES.includes(value),
								"Invalid repository color",
							)
							.optional(),
						branchPrefixMode: z.enum(BRANCH_PREFIX_MODES).nullable().optional(),
						branchPrefixCustom: z.string().nullable().optional(),
					}),
				}),
			)
			.mutation(({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.id))
					.get();
				if (!repository) {
					throw new Error(`Repository ${input.id} not found`);
				}

				localDb
					.update(repositories)
					.set({
						...(input.patch.name !== undefined && { name: input.patch.name }),
						...(input.patch.color !== undefined && {
							color: input.patch.color,
						}),
						...(input.patch.branchPrefixMode !== undefined && {
							branchPrefixMode: input.patch.branchPrefixMode,
						}),
						...(input.patch.branchPrefixCustom !== undefined && {
							branchPrefixCustom: input.patch.branchPrefixCustom,
						}),
						lastOpenedAt: Date.now(),
					})
					.where(eq(repositories.id, input.id))
					.run();

				return { success: true };
			}),

		reorder: publicProcedure
			.input(
				z.object({
					fromIndex: z.number(),
					toIndex: z.number(),
				}),
			)
			.mutation(({ input }) => {
				const { fromIndex, toIndex } = input;

				const activeRepositories = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.tabOrder, repositories.tabOrder)) // Just get all with non-null tabOrder
					.all()
					.filter((r) => r.tabOrder !== null)
					.sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0));

				if (
					fromIndex < 0 ||
					fromIndex >= activeRepositories.length ||
					toIndex < 0 ||
					toIndex >= activeRepositories.length
				) {
					throw new Error("Invalid fromIndex or toIndex");
				}

				const [removed] = activeRepositories.splice(fromIndex, 1);
				activeRepositories.splice(toIndex, 0, removed);

				for (let i = 0; i < activeRepositories.length; i++) {
					localDb
						.update(repositories)
						.set({ tabOrder: i })
						.where(eq(repositories.id, activeRepositories[i].id))
						.run();
				}

				return { success: true };
			}),

		refreshDefaultBranch: publicProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.id))
					.get();

				if (!repository) {
					throw new Error(`Repository ${input.id} not found`);
				}

				const remoteDefaultBranch = await refreshDefaultBranch(repository.mainRepoPath);

				if (remoteDefaultBranch && remoteDefaultBranch !== repository.defaultBranch) {
					localDb
						.update(repositories)
						.set({ defaultBranch: remoteDefaultBranch })
						.where(eq(repositories.id, input.id))
						.run();

					return {
						success: true,
						defaultBranch: remoteDefaultBranch,
						changed: true,
						previousBranch: repository.defaultBranch,
					};
				}

				// Ensure we always return a valid default branch
				const defaultBranch =
					repository.defaultBranch ??
					remoteDefaultBranch ??
					(await getDefaultBranch(repository.mainRepoPath));

				return {
					success: true,
					defaultBranch,
					changed: false,
				};
			}),

		close: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
			const repository = localDb
				.select()
				.from(repositories)
				.where(eq(repositories.id, input.id))
				.get();

			if (!repository) {
				throw new Error("Repository not found");
			}

			const repositoryNodes = localDb
				.select()
				.from(nodes)
				.where(eq(nodes.repositoryId, input.id))
				.all();

			let totalFailed = 0;
			const registry = getNodeRuntimeRegistry();
			for (const node of repositoryNodes) {
				const terminal = registry.getForNodeId(node.id).terminal;
				const terminalResult = await terminal.killByWorkspaceId(node.id);
				totalFailed += terminalResult.failed;
			}

			const closedNodeIds = repositoryNodes.map((n) => n.id);

			if (closedNodeIds.length > 0) {
				localDb.delete(nodes).where(inArray(nodes.id, closedNodeIds)).run();
			}

			// Hide the repository by setting tabOrder to null
			localDb
				.update(repositories)
				.set({ tabOrder: null })
				.where(eq(repositories.id, input.id))
				.run();

			// Update active node if it was in this repository
			const currentSettings = localDb.select().from(settings).get();
			if (
				currentSettings?.lastActiveNodeId &&
				closedNodeIds.includes(currentSettings.lastActiveNodeId)
			) {
				const remainingNodes = localDb.select().from(nodes).orderBy(desc(nodes.lastOpenedAt)).all();

				localDb
					.update(settings)
					.set({
						lastActiveNodeId: remainingNodes[0]?.id ?? null,
					})
					.where(eq(settings.id, 1))
					.run();
			}

			const terminalWarning =
				totalFailed > 0 ? `${totalFailed} terminal process(es) may still be running` : undefined;

			track("repository_closed", { repository_id: input.id });

			return { success: true, terminalWarning };
		}),

		getGitHubAvatar: publicProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.id))
					.get();

				if (!repository) {
					console.log("[getGitHubAvatar] Repository not found:", input.id);
					return null;
				}

				if (repository.githubOwner) {
					console.log("[getGitHubAvatar] Using cached owner:", repository.githubOwner);
					return {
						owner: repository.githubOwner,
						avatarUrl: getGitHubAvatarUrl(repository.githubOwner),
					};
				}

				console.log("[getGitHubAvatar] Fetching owner for:", repository.mainRepoPath);
				const owner = await fetchGitHubOwner(repository.mainRepoPath);

				if (!owner) {
					console.log("[getGitHubAvatar] Failed to fetch owner");
					return null;
				}

				console.log("[getGitHubAvatar] Fetched owner:", owner);

				localDb
					.update(repositories)
					.set({ githubOwner: owner })
					.where(eq(repositories.id, input.id))
					.run();

				return {
					owner,
					avatarUrl: getGitHubAvatarUrl(owner),
				};
			}),

		getGitAuthor: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
			const repository = localDb
				.select()
				.from(repositories)
				.where(eq(repositories.id, input.id))
				.get();

			if (!repository) {
				return null;
			}

			const authorName = await getGitAuthorName(repository.mainRepoPath);
			if (!authorName) {
				return null;
			}

			return {
				name: authorName,
				prefix: sanitizeAuthorPrefix(authorName),
			};
		}),
	});
};

export type RepositoriesRouter = ReturnType<typeof createRepositoriesRouter>;
