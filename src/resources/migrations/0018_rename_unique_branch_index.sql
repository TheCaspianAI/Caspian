-- Rename the unique branch index from workspaces prefix to nodes prefix
-- (missed during the table rename in migration 0017)
DROP INDEX IF EXISTS `workspaces_unique_branch_per_project`;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `nodes_unique_branch_per_project` ON `nodes` (`project_id`) WHERE `type` = 'branch';
