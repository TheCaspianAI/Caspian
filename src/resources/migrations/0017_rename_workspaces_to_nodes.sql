-- Rename workspaces table to nodes
ALTER TABLE `workspaces` RENAME TO `nodes`;
--> statement-breakpoint
-- Rename settings column from last_active_workspace_id to last_active_node_id
ALTER TABLE `settings` RENAME COLUMN `last_active_workspace_id` TO `last_active_node_id`;
--> statement-breakpoint
-- Drop old indexes
DROP INDEX IF EXISTS `workspaces_project_id_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `workspaces_worktree_id_idx`;
--> statement-breakpoint
DROP INDEX IF EXISTS `workspaces_last_opened_at_idx`;
--> statement-breakpoint
-- Create new indexes with nodes prefix
CREATE INDEX `nodes_project_id_idx` ON `nodes` (`project_id`);
--> statement-breakpoint
CREATE INDEX `nodes_worktree_id_idx` ON `nodes` (`worktree_id`);
--> statement-breakpoint
CREATE INDEX `nodes_last_opened_at_idx` ON `nodes` (`last_opened_at`);
