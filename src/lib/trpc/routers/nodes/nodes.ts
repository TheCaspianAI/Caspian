import { mergeRouters } from "../..";
import { createBranchProcedures } from "./procedures/branch";
import { createCreateProcedures } from "./procedures/create";
import { createDeleteProcedures } from "./procedures/delete";
import { createGitStatusProcedures } from "./procedures/git-status";
import { createInitProcedures } from "./procedures/init";
import { createQueryProcedures } from "./procedures/query";
import { createStatusProcedures } from "./procedures/status";

/**
 * Nodes router - manages node lifecycle, git operations, and status.
 *
 * Procedures are organized into logical groups:
 * - create: create, createBranchNode, openWorktree
 * - delete: delete, close, canDelete
 * - query: get, getAll, getAllGrouped
 * - branch: getBranches, switchBranchNode
 * - git-status: refreshGitStatus, getGitHubStatus, getWorktreeInfo, getWorktreesByRepository
 * - status: reorder, update, setUnread
 * - init: onInitProgress, retryInit, getInitProgress, getSetupCommands
 */
export const createNodesRouter = () => {
	return mergeRouters(
		createCreateProcedures(),
		createDeleteProcedures(),
		createQueryProcedures(),
		createBranchProcedures(),
		createGitStatusProcedures(),
		createStatusProcedures(),
		createInitProcedures(),
	);
};

export type NodesRouter = ReturnType<typeof createNodesRouter>;
