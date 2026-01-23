use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebouncedEventKind, Debouncer};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Event emitted when files change in a watched directory
#[derive(Debug, Clone, Serialize)]
pub struct FilesChangedEvent {
    pub node_id: String,
    pub paths: Vec<String>,
    pub timestamp: u64,
}

/// Patterns to ignore when watching for file changes
const IGNORED_PATTERNS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    "*.log",
    "*.tmp",
    ".DS_Store",
    "Thumbs.db",
    ".env.local",
    "*.swp",
    "*.swo",
    "*~",
];

/// Check if a path should be ignored
fn should_ignore(path: &Path) -> bool {
    let path_str = path.to_string_lossy();

    for pattern in IGNORED_PATTERNS {
        if pattern.starts_with('*') {
            // Wildcard pattern - check suffix
            let suffix = &pattern[1..];
            if path_str.ends_with(suffix) {
                return true;
            }
        } else {
            // Directory/file name pattern
            for component in path.components() {
                if let std::path::Component::Normal(name) = component {
                    if name.to_string_lossy() == *pattern {
                        return true;
                    }
                }
            }
        }
    }

    false
}

/// File watcher instance for a single node
struct NodeWatcher {
    _debouncer: Debouncer<RecommendedWatcher>,
}

/// Manager for all file watchers
pub struct FileWatcherManager {
    watchers: Mutex<HashMap<String, NodeWatcher>>,
    app_handle: AppHandle,
}

impl FileWatcherManager {
    /// Create a new FileWatcherManager
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
            app_handle,
        }
    }

    /// Start watching a directory for a node
    pub fn start_watching(&self, node_id: String, worktree_path: PathBuf) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|e| e.to_string())?;

        // Stop existing watcher for this node if any
        watchers.remove(&node_id);

        // Clone values for the closure
        let app_handle = self.app_handle.clone();
        let node_id_clone = node_id.clone();
        let worktree_path_clone = worktree_path.clone();

        // Create debounced watcher with 500ms debounce
        let mut debouncer = new_debouncer(
            Duration::from_millis(500),
            move |result: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
                match result {
                    Ok(events) => {
                        // Filter out ignored paths and collect changed paths
                        let changed_paths: Vec<String> = events
                            .into_iter()
                            .filter(|e| e.kind == DebouncedEventKind::Any)
                            .map(|e| e.path)
                            .filter(|p| !should_ignore(p))
                            .filter_map(|p| {
                                // Convert to relative path
                                p.strip_prefix(&worktree_path_clone)
                                    .ok()
                                    .map(|rel| rel.to_string_lossy().to_string())
                            })
                            .collect();

                        if !changed_paths.is_empty() {
                            let event = FilesChangedEvent {
                                node_id: node_id_clone.clone(),
                                paths: changed_paths,
                                timestamp: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as u64,
                            };

                            log::info!(
                                "[FileWatcher] Emitting files:changed for node {} ({} files)",
                                event.node_id,
                                event.paths.len()
                            );

                            if let Err(e) = app_handle.emit("files:changed", event) {
                                log::error!("[FileWatcher] Failed to emit event: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("[FileWatcher] Watch error: {:?}", e);
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create debouncer: {}", e))?;

        // Start watching the directory
        debouncer
            .watcher()
            .watch(&worktree_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {}", e))?;

        log::info!(
            "[FileWatcher] Started watching {} for node {}",
            worktree_path.display(),
            node_id
        );

        watchers.insert(
            node_id,
            NodeWatcher {
                _debouncer: debouncer,
            },
        );

        Ok(())
    }

    /// Stop watching for a specific node
    pub fn stop_watching(&self, node_id: &str) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|e| e.to_string())?;

        if watchers.remove(node_id).is_some() {
            log::info!("[FileWatcher] Stopped watching for node {}", node_id);
        }

        Ok(())
    }

    /// Stop all watchers (cleanup)
    pub fn stop_all(&self) -> Result<(), String> {
        let mut watchers = self.watchers.lock().map_err(|e| e.to_string())?;
        let count = watchers.len();
        watchers.clear();
        log::info!("[FileWatcher] Stopped all {} watchers", count);
        Ok(())
    }

    /// Check if a node is being watched
    pub fn is_watching(&self, node_id: &str) -> bool {
        self.watchers
            .lock()
            .map(|w| w.contains_key(node_id))
            .unwrap_or(false)
    }
}
