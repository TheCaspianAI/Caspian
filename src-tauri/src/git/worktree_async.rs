//! Async worktree operations with progress events and retry logic.
//!
//! This module provides non-blocking worktree operations that run in background threads
//! and emit Tauri events for progress updates.

use super::{create_worktree, remove_worktree, open_repo, GitError};
use crate::db::get_db_path;
use log;
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Event payload for worktree operation progress
#[derive(Debug, Clone, Serialize)]
pub struct WorktreeProgressEvent {
    pub node_id: String,
    pub status: String, // "pending", "creating", "ready", "failed", "retrying", "removing"
    pub progress: u8,   // 0-100
    pub message: Option<String>,
    pub attempt: u8,
    pub max_attempts: u8,
}

/// Default number of retry attempts for worktree operations
pub const DEFAULT_MAX_RETRIES: u8 = 3;

/// Emit a worktree progress event to the frontend
fn emit_progress(
    app: &AppHandle,
    node_id: &str,
    status: &str,
    progress: u8,
    message: Option<String>,
    attempt: u8,
    max_attempts: u8,
) {
    let event = WorktreeProgressEvent {
        node_id: node_id.to_string(),
        status: status.to_string(),
        progress,
        message,
        attempt,
        max_attempts,
    };

    // Emit to node-specific channel
    let _ = app.emit(&format!("worktree:progress:{}", node_id), &event);

    // Also emit to global channel for UI that tracks all operations
    let _ = app.emit("worktree:progress", &event);
}

/// Update node worktree status in the database
fn update_node_worktree_status(node_id: &str, status: &str, worktree_path: Option<&Path>) {
    let db_path = get_db_path();
    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!("[worktree_async] Failed to open DB: {}", e);
            return;
        }
    };

    let now = chrono::Utc::now().to_rfc3339();
    let path_str = worktree_path.map(|p| p.to_string_lossy().to_string());

    let result = conn.execute(
        "UPDATE nodes SET worktree_status = ?1, worktree_path = COALESCE(?2, worktree_path), updated_at = ?3 WHERE id = ?4",
        rusqlite::params![status, path_str, &now, node_id],
    );

    if let Err(e) = result {
        log::error!("[worktree_async] Failed to update node status: {}", e);
    }
}

/// Configuration for async worktree creation
pub struct CreateWorktreeConfig {
    pub node_id: String,
    pub repo_path: PathBuf,
    pub branch_name: String,
    pub parent_branch: String,
    pub max_retries: u8,
}

/// Spawn a background thread to create a worktree with retry logic.
///
/// This function returns immediately. Progress is reported via Tauri events:
/// - `worktree:progress` (global) and `worktree:progress:{node_id}` (node-specific)
///
/// The database is updated when the operation completes or fails.
pub fn spawn_create_worktree(app: AppHandle, config: CreateWorktreeConfig) {
    let node_id = config.node_id;
    let repo_path = config.repo_path;
    let branch_name = config.branch_name;
    let parent_branch = config.parent_branch;
    let max_retries = config.max_retries;

    thread::spawn(move || {
        log::info!(
            "[worktree_async] Starting worktree creation for node={} branch={}",
            node_id, branch_name
        );

        // Update status to creating
        update_node_worktree_status(&node_id, "creating", None);
        emit_progress(&app, &node_id, "creating", 10, None, 1, max_retries);

        for attempt in 1..=max_retries {
            // Open repository
            let repo = match open_repo(&repo_path) {
                Ok(r) => r,
                Err(e) => {
                    let msg = format!("Failed to open repository: {}", e);
                    log::error!("[worktree_async] {}", msg);

                    if attempt < max_retries {
                        emit_progress(
                            &app,
                            &node_id,
                            "retrying",
                            0,
                            Some(msg),
                            attempt + 1,
                            max_retries,
                        );
                        thread::sleep(Duration::from_millis(500 * attempt as u64));
                        continue;
                    } else {
                        update_node_worktree_status(&node_id, "failed", None);
                        emit_progress(
                            &app,
                            &node_id,
                            "failed",
                            0,
                            Some(msg),
                            attempt,
                            max_retries,
                        );
                        return;
                    }
                }
            };

            // Emit progress - about to create worktree
            emit_progress(
                &app,
                &node_id,
                "creating",
                30,
                Some("Creating branch and worktree...".to_string()),
                attempt,
                max_retries,
            );

            // Create the worktree
            match create_worktree(&repo, &branch_name, &parent_branch) {
                Ok(worktree_info) => {
                    log::info!(
                        "[worktree_async] Worktree created successfully at {:?}",
                        worktree_info.path
                    );

                    // Update DB with success
                    update_node_worktree_status(&node_id, "ready", Some(&worktree_info.path));

                    // Emit completion event
                    emit_progress(&app, &node_id, "ready", 100, None, attempt, max_retries);
                    return;
                }
                Err(e) => {
                    let msg = format!("Worktree creation failed: {}", e);
                    log::warn!("[worktree_async] {} (attempt {}/{})", msg, attempt, max_retries);

                    if attempt < max_retries {
                        // Check if it's a retryable error
                        if is_retryable_error(&e) {
                            emit_progress(
                                &app,
                                &node_id,
                                "retrying",
                                0,
                                Some(msg),
                                attempt + 1,
                                max_retries,
                            );
                            // Exponential backoff
                            thread::sleep(Duration::from_millis(500 * attempt as u64));
                            continue;
                        }
                    }

                    // Final failure
                    update_node_worktree_status(&node_id, "failed", None);
                    emit_progress(
                        &app,
                        &node_id,
                        "failed",
                        0,
                        Some(msg),
                        attempt,
                        max_retries,
                    );
                    return;
                }
            }
        }
    });
}

/// Check if an error is retryable (transient errors like IO issues)
fn is_retryable_error(error: &GitError) -> bool {
    match error {
        GitError::Io(_) => true,
        GitError::Git2(e) => {
            // Retry on certain git errors (e.g., lock contention)
            let msg = e.message().to_lowercase();
            msg.contains("lock") || msg.contains("busy") || msg.contains("timeout")
        }
        GitError::WorktreeError(msg) => {
            let msg_lower = msg.to_lowercase();
            msg_lower.contains("lock") || msg_lower.contains("busy")
        }
        _ => false,
    }
}

/// Configuration for async worktree removal
pub struct RemoveWorktreeConfig {
    pub node_id: String,
    pub repo_path: PathBuf,
    pub branch_name: String,
    pub worktree_path: Option<PathBuf>,
}

/// Spawn a background thread to remove a worktree.
///
/// This function returns immediately. Progress is reported via Tauri events.
pub fn spawn_remove_worktree(app: AppHandle, config: RemoveWorktreeConfig) {
    let node_id = config.node_id;
    let repo_path = config.repo_path;
    let branch_name = config.branch_name;
    let worktree_path = config.worktree_path;

    thread::spawn(move || {
        log::info!(
            "[worktree_async] Starting worktree removal for node={} branch={}",
            node_id, branch_name
        );

        emit_progress(&app, &node_id, "removing", 10, None, 1, 1);

        // Remove worktree directory if it exists
        if let Some(ref wt_path) = worktree_path {
            if wt_path.exists() {
                emit_progress(
                    &app,
                    &node_id,
                    "removing",
                    30,
                    Some("Removing worktree directory...".to_string()),
                    1,
                    1,
                );
                if let Err(e) = std::fs::remove_dir_all(wt_path) {
                    log::error!("[worktree_async] Failed to remove worktree dir: {}", e);
                }
            }
        }

        emit_progress(
            &app,
            &node_id,
            "removing",
            60,
            Some("Cleaning up git references...".to_string()),
            1,
            1,
        );

        // Clean up git worktree references and delete branch
        if let Ok(repo) = open_repo(&repo_path) {
            let _ = remove_worktree(&repo, &branch_name);

            // Delete the git branch
            if let Ok(mut branch) = repo.find_branch(&branch_name, git2::BranchType::Local) {
                let _ = branch.delete();
            }
        }

        emit_progress(
            &app,
            &node_id,
            "removed",
            100,
            Some("Worktree removed".to_string()),
            1,
            1,
        );

        log::info!("[worktree_async] Worktree removal complete for node={}", node_id);
    });
}
