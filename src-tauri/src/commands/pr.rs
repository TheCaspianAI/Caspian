use crate::db::Database;
use super::repository::CommandResult;
use log;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Arc;
use tauri::State;

/// PR information from GitHub
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrInfo {
    pub number: u32,
    pub url: String,
    pub state: String,              // "OPEN", "CLOSED", "MERGED"
    pub mergeable: String,          // "MERGEABLE", "CONFLICTING", "UNKNOWN"
    pub merge_state_status: String, // "CLEAN", "DIRTY", "BLOCKED", "BEHIND", "UNSTABLE", etc.
    pub title: String,
}

/// Response from gh pr view --json
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GhPrResponse {
    number: u32,
    url: String,
    state: String,
    mergeable: String,
    #[serde(default)]
    merge_state_status: String,
    title: String,
}

/// Get PR info for a node's branch
/// Returns None if no PR exists for the branch
#[tauri::command]
pub fn get_pr_info(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Option<PrInfo>> {
    let conn = db.conn.lock().unwrap();

    // Get worktree path and branch name for the node
    let (worktree_path, internal_branch): (Option<String>, String) = match conn.query_row(
        "SELECT worktree_path, internal_branch FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(result) => result,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Check if worktree is ready
    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => return CommandResult::err("Worktree not ready"),
    };

    // Run gh pr view to get PR info for the current branch
    // Using --json to get structured data
    let output = Command::new("gh")
        .args([
            "pr",
            "view",
            &internal_branch,
            "--json",
            "number,url,state,mergeable,mergeStateStatus,title",
        ])
        .current_dir(&worktree_path)
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                // Parse JSON response
                let json_str = String::from_utf8_lossy(&output.stdout);
                match serde_json::from_str::<GhPrResponse>(&json_str) {
                    Ok(pr) => CommandResult::ok(Some(PrInfo {
                        number: pr.number,
                        url: pr.url,
                        state: pr.state,
                        mergeable: pr.mergeable,
                        merge_state_status: pr.merge_state_status,
                        title: pr.title,
                    })),
                    Err(e) => {
                        log::error!("Failed to parse gh response: {}", e);
                        CommandResult::ok(None)
                    }
                }
            } else {
                // No PR exists for this branch (gh returns non-zero)
                // This is expected, not an error
                CommandResult::ok(None)
            }
        }
        Err(e) => {
            log::error!("Failed to run gh: {}", e);
            CommandResult::err(&format!("Failed to check PR status: {}", e))
        }
    }
}
