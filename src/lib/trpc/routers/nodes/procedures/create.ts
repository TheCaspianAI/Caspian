import { homedir } from "node:os";
import { join } from "node:path";
import { repositories, settings, nodes, worktrees } from "lib/local-db";
import { and, eq, isNull, not } from "drizzle-orm";
import { track } from "main/lib/analytics";
import { localDb } from "main/lib/local-db";
import { nodeInitManager } from "main/lib/node-init-manager";
import { CASPIAN_DIR_NAME, WORKTREES_DIR_NAME } from "shared/constants";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import {
	activateRepository,
	getBranchNode,
	getMaxNodeTabOrder,
	getRepository,
	getWorktree,
	setLastActiveNode,
	touchNode,
} from "../utils/db-helpers";
import {
	createWorktreeFromPr,
	fetchPrBranch,
	generateBranchName,
	getBranchPrefix,
	getBranchWorktreePath,
	getCurrentBranch,
	getPrInfo,
	getPrLocalBranchName,
	listBranches,
	type PullRequestInfo,
	parsePrUrl,
	safeCheckoutBranch,
	sanitizeAuthorPrefix,
	sanitizeBranchName,
	worktreeExists,
} from "../utils/git";
import { loadSetupConfig } from "../utils/setup";
import { initializeNodeWorktree } from "../utils/node-init";

interface CreateNodeFromWorktreeParams {
	repositoryId: string;
	worktreeId: string;
	branch: string;
	name: string;
}

function createNodeFromWorktree({
	repositoryId,
	worktreeId,
	branch,
	name,
}: CreateNodeFromWorktreeParams) {
	const maxTabOrder = getMaxNodeTabOrder(repositoryId);

	const node = localDb
		.insert(nodes)
		.values({
			repositoryId,
			worktreeId,
			type: "worktree",
			branch,
			name,
			tabOrder: maxTabOrder + 1,
		})
		.returning()
		.get();

	setLastActiveNode(node.id);

	return node;
}

function getPrNodeName(prInfo: PullRequestInfo): string {
	return prInfo.title || `PR #${prInfo.number}`;
}

interface PrNodeResult {
	node: typeof nodes.$inferSelect;
	initialCommands: string[] | null;
	worktreePath: string;
	repositoryId: string;
	prNumber: number;
	prTitle: string;
	wasExisting: boolean;
}

interface HandleExistingWorktreeParams {
	existingWorktree: typeof worktrees.$inferSelect;
	repository: typeof repositories.$inferSelect;
	prInfo: PullRequestInfo;
	localBranchName: string;
	nodeName: string;
	setupConfig: { setup?: string[] } | null;
}

function handleExistingWorktree({
	existingWorktree,
	repository,
	prInfo,
	localBranchName,
	nodeName,
	setupConfig,
}: HandleExistingWorktreeParams): PrNodeResult {
	const existingNode = localDb
		.select()
		.from(nodes)
		.where(
			and(
				eq(nodes.worktreeId, existingWorktree.id),
				isNull(nodes.deletingAt),
			),
		)
		.get();

	if (existingNode) {
		touchNode(existingNode.id);
		setLastActiveNode(existingNode.id);

		return {
			node: existingNode,
			initialCommands: null,
			worktreePath: existingWorktree.path,
			repositoryId: repository.id,
			prNumber: prInfo.number,
			prTitle: prInfo.title,
			wasExisting: true,
		};
	}

	const node = createNodeFromWorktree({
		repositoryId: repository.id,
		worktreeId: existingWorktree.id,
		branch: localBranchName,
		name: nodeName,
	});

	activateRepository(repository);

	track("node_opened", {
		node_id: node.id,
		repository_id: repository.id,
		type: "worktree",
		source: "pr",
		pr_number: prInfo.number,
	});

	return {
		node,
		initialCommands: setupConfig?.setup || null,
		worktreePath: existingWorktree.path,
		repositoryId: repository.id,
		prNumber: prInfo.number,
		prTitle: prInfo.title,
		wasExisting: true,
	};
}

interface HandleNewWorktreeParams {
	repository: typeof repositories.$inferSelect;
	prInfo: PullRequestInfo;
	localBranchName: string;
	nodeName: string;
	setupConfig: { setup?: string[] } | null;
}

async function handleNewWorktree({
	repository,
	prInfo,
	localBranchName,
	nodeName,
	setupConfig,
}: HandleNewWorktreeParams): Promise<PrNodeResult> {
	const existingWorktreePath = await getBranchWorktreePath({
		mainRepoPath: repository.mainRepoPath,
		branch: localBranchName,
	});
	if (existingWorktreePath) {
		throw new Error(
			`This PR's branch is already checked out in a worktree at: ${existingWorktreePath}`,
		);
	}

	await fetchPrBranch({
		repoPath: repository.mainRepoPath,
		prInfo,
	});

	const worktreePath = join(
		homedir(),
		CASPIAN_DIR_NAME,
		WORKTREES_DIR_NAME,
		repository.name,
		localBranchName,
	);

	await createWorktreeFromPr({
		mainRepoPath: repository.mainRepoPath,
		worktreePath,
		prInfo,
		localBranchName,
	});

	const defaultBranch = repository.defaultBranch || "main";

	const worktree = localDb
		.insert(worktrees)
		.values({
			repositoryId: repository.id,
			path: worktreePath,
			branch: localBranchName,
			baseBranch: defaultBranch,
			gitStatus: null,
		})
		.returning()
		.get();

	const node = createNodeFromWorktree({
		repositoryId: repository.id,
		worktreeId: worktree.id,
		branch: localBranchName,
		name: nodeName,
	});

	activateRepository(repository);

	track("node_created", {
		node_id: node.id,
		repository_id: repository.id,
		branch: localBranchName,
		source: "pr",
		pr_number: prInfo.number,
		is_fork: prInfo.isCrossRepository,
	});

	nodeInitManager.startJob(node.id, repository.id);
	initializeNodeWorktree({
		nodeId: node.id,
		repositoryId: repository.id,
		worktreeId: worktree.id,
		worktreePath,
		branch: localBranchName,
		baseBranch: defaultBranch,
		baseBranchWasExplicit: false,
		mainRepoPath: repository.mainRepoPath,
		useExistingBranch: true,
		skipWorktreeCreation: true,
	});

	return {
		node,
		initialCommands: setupConfig?.setup || null,
		worktreePath,
		repositoryId: repository.id,
		prNumber: prInfo.number,
		prTitle: prInfo.title,
		wasExisting: false,
	};
}

export const createCreateProcedures = () => {
	return router({
		create: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					name: z.string().optional(),
					branchName: z.string().optional(),
					baseBranch: z.string().optional(),
					useExistingBranch: z.boolean().optional(),
					applyPrefix: z.boolean().optional().default(true),
					setupScript: z.string().optional(),
					teardownScript: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					throw new Error(`Repository ${input.repositoryId} not found`);
				}

				let existingBranchName: string | undefined;
				if (input.useExistingBranch) {
					existingBranchName = input.branchName?.trim();
					if (!existingBranchName) {
						throw new Error(
							"Branch name is required when using an existing branch",
						);
					}

					const existingWorktreePath = await getBranchWorktreePath({
						mainRepoPath: repository.mainRepoPath,
						branch: existingBranchName,
					});
					if (existingWorktreePath) {
						throw new Error(
							`Branch "${existingBranchName}" is already checked out in another worktree at: ${existingWorktreePath}`,
						);
					}
				}

				const { local, remote } = await listBranches(repository.mainRepoPath);
				const existingBranches = [...local, ...remote];

				let branchPrefix: string | undefined;
				if (input.applyPrefix) {
					const globalSettings = localDb.select().from(settings).get();
					const repositoryOverrides = repository.branchPrefixMode != null;
					const prefixMode = repositoryOverrides
						? repository.branchPrefixMode
						: (globalSettings?.branchPrefixMode ?? "none");
					const customPrefix = repositoryOverrides
						? repository.branchPrefixCustom
						: globalSettings?.branchPrefixCustom;

					const rawPrefix = await getBranchPrefix({
						repoPath: repository.mainRepoPath,
						mode: prefixMode,
						customPrefix,
					});
					const sanitizedPrefix = rawPrefix
						? sanitizeAuthorPrefix(rawPrefix)
						: undefined;

					const existingSet = new Set(
						existingBranches.map((b) => b.toLowerCase()),
					);
					const prefixWouldCollide =
						sanitizedPrefix && existingSet.has(sanitizedPrefix.toLowerCase());
					branchPrefix = prefixWouldCollide ? undefined : sanitizedPrefix;
				}

				const withPrefix = (name: string): string =>
					branchPrefix ? `${branchPrefix}/${name}` : name;

				let branch: string;
				if (existingBranchName) {
					if (!existingBranches.includes(existingBranchName)) {
						throw new Error(
							`Branch "${existingBranchName}" does not exist. Please select an existing branch.`,
						);
					}
					branch = existingBranchName;
				} else if (input.branchName?.trim()) {
					branch = withPrefix(sanitizeBranchName(input.branchName));
				} else {
					branch = generateBranchName({
						existingBranches,
						authorPrefix: branchPrefix,
					});
				}

				const worktreePath = join(
					homedir(),
					CASPIAN_DIR_NAME,
					WORKTREES_DIR_NAME,
					repository.name,
					branch,
				);

				const defaultBranch = repository.defaultBranch || "main";
				const targetBranch = input.baseBranch || defaultBranch;

				const worktree = localDb
					.insert(worktrees)
					.values({
						repositoryId: input.repositoryId,
						path: worktreePath,
						branch,
						baseBranch: targetBranch,
						gitStatus: null,
					})
					.returning()
					.get();

				const maxTabOrder = getMaxNodeTabOrder(input.repositoryId);

				const node = localDb
					.insert(nodes)
					.values({
						repositoryId: input.repositoryId,
						worktreeId: worktree.id,
						type: "worktree",
						branch,
						name: input.name ?? branch,
						tabOrder: maxTabOrder + 1,
						customTeardownScript: input.teardownScript?.trim() || null,
					})
					.returning()
					.get();

				setLastActiveNode(node.id);
				activateRepository(repository);

				track("node_created", {
					node_id: node.id,
					repository_id: repository.id,
					branch: branch,
					base_branch: targetBranch,
					use_existing_branch: input.useExistingBranch ?? false,
				});

				nodeInitManager.startJob(node.id, input.repositoryId);
				initializeNodeWorktree({
					nodeId: node.id,
					repositoryId: input.repositoryId,
					worktreeId: worktree.id,
					worktreePath,
					branch,
					baseBranch: targetBranch,
					baseBranchWasExplicit: !!input.baseBranch,
					mainRepoPath: repository.mainRepoPath,
					useExistingBranch: input.useExistingBranch,
				});

				const setupConfig = loadSetupConfig(repository.mainRepoPath);

				// Use custom setup script if provided, otherwise fall back to repository config
				const initialCommands = input.setupScript?.trim()
					? [input.setupScript.trim()]
					: setupConfig?.setup || null;

				return {
					node,
					initialCommands,
					worktreePath,
					repositoryId: repository.id,
					isInitializing: true,
				};
			}),

		createBranchNode: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					branch: z.string().optional(),
					name: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const repository = localDb
					.select()
					.from(repositories)
					.where(eq(repositories.id, input.repositoryId))
					.get();
				if (!repository) {
					throw new Error(`Repository ${input.repositoryId} not found`);
				}

				const branch =
					input.branch || (await getCurrentBranch(repository.mainRepoPath));
				if (!branch) {
					throw new Error("Could not determine current branch");
				}

				if (input.branch) {
					const existingBranchNode = getBranchNode(input.repositoryId);
					if (
						existingBranchNode &&
						existingBranchNode.branch !== branch
					) {
						throw new Error(
							`A main node already exists on branch "${existingBranchNode.branch}". ` +
								`Use the branch switcher to change branches.`,
						);
					}
					await safeCheckoutBranch(repository.mainRepoPath, input.branch);
				}

				const existing = getBranchNode(input.repositoryId);

				if (existing) {
					touchNode(existing.id);
					setLastActiveNode(existing.id);
					return {
						node: { ...existing, lastOpenedAt: Date.now() },
						worktreePath: repository.mainRepoPath,
						repositoryId: repository.id,
						wasExisting: true,
					};
				}

				const insertResult = localDb
					.insert(nodes)
					.values({
						repositoryId: input.repositoryId,
						type: "branch",
						branch,
						name: branch,
						tabOrder: 0,
					})
					.onConflictDoNothing()
					.returning()
					.all();

				const wasExisting = insertResult.length === 0;

				if (!wasExisting) {
					const newNodeId = insertResult[0].id;
					const repositoryNodes = localDb
						.select()
						.from(nodes)
						.where(
							and(
								eq(nodes.repositoryId, input.repositoryId),
								// Exclude the node we just inserted
								not(eq(nodes.id, newNodeId)),
								isNull(nodes.deletingAt),
							),
						)
						.all();
					for (const n of repositoryNodes) {
						localDb
							.update(nodes)
							.set({ tabOrder: n.tabOrder + 1 })
							.where(eq(nodes.id, n.id))
							.run();
					}
				}

				const node =
					insertResult[0] ?? getBranchNode(input.repositoryId);

				if (!node) {
					throw new Error("Failed to create or find branch node");
				}

				setLastActiveNode(node.id);

				if (!wasExisting) {
					activateRepository(repository);

					track("node_opened", {
						node_id: node.id,
						repository_id: repository.id,
						type: "branch",
						was_existing: false,
					});
				}

				return {
					node,
					worktreePath: repository.mainRepoPath,
					repositoryId: repository.id,
					wasExisting,
				};
			}),

		openWorktree: publicProcedure
			.input(
				z.object({
					worktreeId: z.string(),
					name: z.string().optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const worktree = getWorktree(input.worktreeId);
				if (!worktree) {
					throw new Error(`Worktree ${input.worktreeId} not found`);
				}

				const existingNode = localDb
					.select()
					.from(nodes)
					.where(
						and(
							eq(nodes.worktreeId, input.worktreeId),
							isNull(nodes.deletingAt),
						),
					)
					.get();
				if (existingNode) {
					throw new Error("Worktree already has an active node");
				}

				const repository = getRepository(worktree.repositoryId);
				if (!repository) {
					throw new Error(`Repository ${worktree.repositoryId} not found`);
				}

				const exists = await worktreeExists(
					repository.mainRepoPath,
					worktree.path,
				);
				if (!exists) {
					throw new Error("Worktree no longer exists on disk");
				}

				const maxTabOrder = getMaxNodeTabOrder(worktree.repositoryId);

				const node = localDb
					.insert(nodes)
					.values({
						repositoryId: worktree.repositoryId,
						worktreeId: worktree.id,
						type: "worktree",
						branch: worktree.branch,
						name: input.name ?? worktree.branch,
						tabOrder: maxTabOrder + 1,
					})
					.returning()
					.get();

				setLastActiveNode(node.id);
				activateRepository(repository);

				const setupConfig = loadSetupConfig(repository.mainRepoPath);

				track("node_opened", {
					node_id: node.id,
					repository_id: repository.id,
					type: "worktree",
				});

				return {
					node,
					initialCommands: setupConfig?.setup || null,
					worktreePath: worktree.path,
					repositoryId: repository.id,
				};
			}),

		createFromPr: publicProcedure
			.input(
				z.object({
					repositoryId: z.string(),
					prUrl: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				const repository = getRepository(input.repositoryId);
				if (!repository) {
					throw new Error(`Repository ${input.repositoryId} not found`);
				}

				const parsed = parsePrUrl(input.prUrl);
				if (!parsed) {
					throw new Error(
						"Invalid PR URL. Expected format: https://github.com/owner/repo/pull/123",
					);
				}

				const prInfo = await getPrInfo({
					owner: parsed.owner,
					repo: parsed.repo,
					prNumber: parsed.number,
				});

				const localBranchName = getPrLocalBranchName(prInfo);
				const nodeName = getPrNodeName(prInfo);
				const setupConfig = loadSetupConfig(repository.mainRepoPath);

				const existingWorktree = localDb
					.select()
					.from(worktrees)
					.where(
						and(
							eq(worktrees.repositoryId, input.repositoryId),
							eq(worktrees.branch, localBranchName),
						),
					)
					.get();

				if (existingWorktree) {
					return handleExistingWorktree({
						existingWorktree,
						repository,
						prInfo,
						localBranchName,
						nodeName,
						setupConfig,
					});
				}

				return handleNewWorktree({
					repository,
					prInfo,
					localBranchName,
					nodeName,
					setupConfig,
				});
			}),
	});
};
