mod agents;
mod audit;
mod auth;
mod chat;
mod commands;
mod db;
mod git;
mod manifest;
mod notifications;
pub mod sentry_utils;
mod state;
mod watcher;

use db::{get_db_path, Database};
use log;
use std::sync::Arc;
use tauri::Manager;
use watcher::FileWatcherManager;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize Sentry for error tracking
    let _sentry_guard = sentry_utils::init_sentry();

    // Initialize database
    let db_path = get_db_path();
    let database = match Database::new(&db_path) {
        Ok(db) => Arc::new(db),
        Err(e) => {
            sentry_utils::capture_error(&e, "database_initialization");
            log::error!("Failed to initialize database: {}", e);
            std::process::exit(1);
        }
    };

    log::info!("Starting tauri builder");
    tauri::Builder::default()
        .manage(database)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        // Always enable logging so we can diagnose startup hangs in dev and release builds.
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            log::info!("Tauri setup: initializing");
            // Clean up stale agent sessions from previous runs.
            // Run synchronously to ensure it completes before frontend loads
            commands::agent::cleanup_stale_sessions();

            // Initialize file watcher manager
            let watcher_manager = Arc::new(FileWatcherManager::new(app.handle().clone()));
            app.manage(watcher_manager);
            log::info!("Tauri setup: file watcher manager initialized");

            // Apply native macOS vibrancy
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").unwrap();
                apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                    .expect("Failed to apply vibrancy");
                log::info!("Tauri setup: macOS vibrancy applied");
            }

            // Linux-specific window setup (if needed)
            #[cfg(target_os = "linux")]
            {
                log::info!("Tauri setup: Linux window configuration applied");
            }

            log::info!("Tauri setup: complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Repository commands
            commands::add_repository,
            commands::list_repositories,
            commands::get_repository,
            commands::remove_repository,
            commands::update_last_accessed,
            commands::check_git_status,
            commands::init_repository,
            commands::clone_repository,
            commands::create_directory,
            commands::test_sentry,
            // Branch commands (legacy)
            commands::create_reasoning_branch,
            commands::create_branch_tree,
            commands::list_branches,
            commands::get_branch,
            commands::delete_branch,
            // Node commands (new)
            commands::create_node,
            commands::list_nodes,
            commands::list_all_nodes,
            commands::get_node,
            commands::update_node_display_name,
            commands::delete_node,
            commands::list_local_branches,
            commands::list_remote_branches,
            commands::update_node_parent_branch,
            commands::rename_node,
            commands::update_node_context,
            commands::retry_worktree_creation,
            // Manifest commands
            commands::get_manifest,
            commands::update_manifest,
            commands::validate_branch_manifest,
            commands::add_ground_rule,
            commands::update_goal,
            // Audit commands
            commands::get_audit_log,
            commands::get_repo_activity,
            // Chat commands
            commands::send_message,
            commands::get_messages,
            commands::get_messages_for_node,
            commands::get_agent_messages_for_turn,
            commands::get_chat_state,
            commands::set_chat_state,
            commands::delete_message,
            commands::get_unread_count,
            // Agent commands
            commands::spawn_agent,
            commands::terminate_agent,
            commands::terminate_agent_for_node,
            commands::get_agent_status,
            commands::get_agent_statuses_batch,
            commands::list_active_agents,
            commands::get_available_adapters,
            commands::is_adapter_available,
            commands::resume_agent_with_input,
            commands::get_pending_user_input,
            commands::run_agent_diagnostics,
            // Memory commands
            commands::add_memory,
            commands::get_workspace_memory,
            commands::delete_memory,
            commands::propagate_node_context,
            commands::search_memory,
            // Notification commands
            commands::get_notification_count,
            commands::mark_notifications_read,
            commands::increment_notification,
            commands::set_requires_input,
            commands::get_all_notification_counts,
            commands::send_system_notification,
            // Auth commands (git-based, with legacy gh CLI support)
            commands::get_auth_status,
            commands::sign_out,
            commands::get_github_user,
            commands::get_auth_actor,
            commands::check_git_configured,
            commands::get_git_user,
            commands::check_gh_cli_installed,
            commands::check_gh_cli_auth,
            commands::install_gh_cli,
            commands::run_gh_auth_login,
            // Diff commands
            commands::get_diff,
            commands::get_branch_diff,
            commands::get_branch_stats,
            commands::get_changed_files,
            commands::get_branch_changed_files,
            commands::get_file_diff,
            commands::get_branch_file_diff,
            // PR commands
            commands::get_pr_info,
            // File watcher commands
            commands::start_file_watcher,
            commands::stop_file_watcher,
            commands::stop_all_file_watchers,
            commands::is_file_watcher_active,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
