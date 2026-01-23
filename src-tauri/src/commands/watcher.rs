use crate::db::Database;
use crate::watcher::FileWatcherManager;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct WatcherResult {
    pub success: bool,
    pub error: Option<String>,
}

/// Start watching a node's worktree for file changes
#[tauri::command]
pub async fn start_file_watcher(
    node_id: String,
    watcher_manager: State<'_, Arc<FileWatcherManager>>,
    database: State<'_, Arc<Database>>,
) -> Result<WatcherResult, String> {
    log::info!("[Watcher] start_file_watcher called for node: {}", node_id);

    // Get the worktree path from the database
    let worktree_path = database
        .get_node_worktree_path(&node_id)
        .map_err(|e| format!("Failed to get worktree path: {}", e))?;

    let worktree_path = match worktree_path {
        Some(path) => PathBuf::from(path),
        None => {
            return Ok(WatcherResult {
                success: false,
                error: Some("Node has no worktree path".to_string()),
            });
        }
    };

    // Check if path exists
    if !worktree_path.exists() {
        return Ok(WatcherResult {
            success: false,
            error: Some(format!(
                "Worktree path does not exist: {}",
                worktree_path.display()
            )),
        });
    }

    // Start watching
    match watcher_manager.start_watching(node_id, worktree_path) {
        Ok(()) => Ok(WatcherResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(WatcherResult {
            success: false,
            error: Some(e),
        }),
    }
}

/// Stop watching a node's worktree
#[tauri::command]
pub async fn stop_file_watcher(
    node_id: String,
    watcher_manager: State<'_, Arc<FileWatcherManager>>,
) -> Result<WatcherResult, String> {
    log::info!("[Watcher] stop_file_watcher called for node: {}", node_id);

    match watcher_manager.stop_watching(&node_id) {
        Ok(()) => Ok(WatcherResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(WatcherResult {
            success: false,
            error: Some(e),
        }),
    }
}

/// Stop all file watchers (cleanup)
#[tauri::command]
pub async fn stop_all_file_watchers(
    watcher_manager: State<'_, Arc<FileWatcherManager>>,
) -> Result<WatcherResult, String> {
    log::info!("[Watcher] stop_all_file_watchers called");

    match watcher_manager.stop_all() {
        Ok(()) => Ok(WatcherResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(WatcherResult {
            success: false,
            error: Some(e),
        }),
    }
}

/// Check if a node is being watched
#[tauri::command]
pub async fn is_file_watcher_active(
    node_id: String,
    watcher_manager: State<'_, Arc<FileWatcherManager>>,
) -> Result<bool, String> {
    Ok(watcher_manager.is_watching(&node_id))
}
