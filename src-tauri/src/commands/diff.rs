use crate::db::Database;
use crate::git::get_worktree_diff;
use super::repository::CommandResult;
use serde::Serialize;
use std::path::Path;
use std::process::Command;
use std::sync::Arc;
use tauri::State;

/// Branch statistics for node cards
#[derive(Debug, Serialize, Clone)]
pub struct BranchStats {
    pub files_changed: u32,
    pub additions: u32,
    pub deletions: u32,
    pub commits: u32,
    pub has_uncommitted: bool,
}

/// A single changed file with its status
#[derive(Debug, Serialize, Clone)]
pub struct ChangedFile {
    pub filename: String,
    pub status: String, // "modified", "added", "deleted", "renamed", "untracked"
    pub additions: u32,
    pub deletions: u32,
}

/// Get diff for a node (uncommitted changes in the worktree)
/// This includes: modified tracked files, staged changes, and untracked files
#[tauri::command]
pub fn get_diff(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<String> {
    let conn = db.conn.lock().unwrap();

    // Get worktree path for the node
    let worktree_path: Option<String> = match conn.query_row(
        "SELECT worktree_path FROM nodes WHERE id = ?1",
        [&node_id],
        |row| row.get(0),
    ) {
        Ok(path) => path,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Check if worktree is ready
    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => return CommandResult::err("Worktree not ready"),
    };

    // Get uncommitted changes in the worktree (staged + unstaged for tracked files)
    let mut combined_diff = match get_worktree_diff(Path::new(&worktree_path)) {
        Ok(diff) => diff,
        Err(e) => return CommandResult::err(&e.to_string()),
    };

    // Also include untracked files (new files not yet added to git)
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&worktree_path)
        .output();

    if let Ok(status) = status_output {
        let status_str = String::from_utf8_lossy(&status.stdout);
        for line in status_str.lines() {
            // Lines starting with "??" are untracked files
            if line.starts_with("?? ") {
                let filename = &line[3..];
                let file_path = Path::new(&worktree_path).join(filename);

                // Read the file content and generate a diff-like output
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    combined_diff.push_str(&format!("diff --git a/{} b/{}\n", filename, filename));
                    combined_diff.push_str("new file mode 100644\n");
                    combined_diff.push_str("--- /dev/null\n");
                    combined_diff.push_str(&format!("+++ b/{}\n", filename));

                    let lines: Vec<&str> = content.lines().collect();
                    let line_count = lines.len();
                    combined_diff.push_str(&format!("@@ -0,0 +1,{} @@\n", line_count));

                    for content_line in lines {
                        combined_diff.push_str(&format!("+{}\n", content_line));
                    }
                }
            }
        }
    }

    CommandResult::ok(combined_diff)
}

/// Get diff between current branch and parent branch (for PR review)
#[tauri::command]
pub fn get_branch_diff(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<String> {
    let conn = db.conn.lock().unwrap();

    // Get worktree path and parent branch for the node
    let (worktree_path, parent_branch): (Option<String>, Option<String>) = match conn.query_row(
        "SELECT worktree_path, parent_branch FROM nodes WHERE id = ?1",
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

    // Get parent branch, default to "main" if not set
    let parent_branch = match parent_branch {
        Some(ref branch) if !branch.is_empty() => branch.clone(),
        _ => "main".to_string(),
    };

    // Run git diff parent_branch to get all changes (committed + uncommitted) vs parent
    // Using just the branch name (not ..HEAD) includes uncommitted changes

    let output = Command::new("git")
        .args(["diff", &parent_branch])
        .current_dir(&worktree_path)
        .output();

    // Get the regular diff first
    let mut combined_diff = match output {
        Ok(output) => {
            if output.status.success() {
                String::from_utf8_lossy(&output.stdout).to_string()
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return CommandResult::err(&format!("Git diff failed: {}", stderr));
            }
        }
        Err(e) => {
            return CommandResult::err(&format!("Failed to run git: {}", e));
        }
    };

    // Now get untracked files and generate diff-like output for them
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&worktree_path)
        .output();

    if let Ok(status) = status_output {
        let status_str = String::from_utf8_lossy(&status.stdout);
        for line in status_str.lines() {
            // Lines starting with "??" are untracked files
            if line.starts_with("?? ") {
                let filename = &line[3..];
                let file_path = Path::new(&worktree_path).join(filename);

                // Read the file content and generate a diff-like output
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    combined_diff.push_str(&format!("diff --git a/{} b/{}\n", filename, filename));
                    combined_diff.push_str("new file mode 100644\n");
                    combined_diff.push_str(&format!("--- /dev/null\n"));
                    combined_diff.push_str(&format!("+++ b/{}\n", filename));

                    let lines: Vec<&str> = content.lines().collect();
                    let line_count = lines.len();
                    combined_diff.push_str(&format!("@@ -0,0 +1,{} @@\n", line_count));

                    for line in lines {
                        combined_diff.push_str(&format!("+{}\n", line));
                    }
                }
            }
        }
    }

    CommandResult::ok(combined_diff)
}

/// Get branch statistics for a node (for node card display)
#[tauri::command]
pub fn get_branch_stats(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<BranchStats> {
    let conn = db.conn.lock().unwrap();

    // Get worktree path and parent branch for the node
    let (worktree_path, parent_branch): (Option<String>, Option<String>) = match conn.query_row(
        "SELECT worktree_path, parent_branch FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(result) => result,
        Err(_) => return CommandResult::err("Node not found"),
    };

    // Check if worktree is ready
    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => {
            // Return empty stats if worktree not ready
            return CommandResult::ok(BranchStats {
                files_changed: 0,
                additions: 0,
                deletions: 0,
                commits: 0,
                has_uncommitted: false,
            });
        }
    };

    let parent_branch = match parent_branch {
        Some(ref branch) if !branch.is_empty() => branch.clone(),
        _ => "main".to_string(),
    };

    // Get diff stats (files changed, additions, deletions)
    let diff_stat_output = Command::new("git")
        .args(["diff", "--stat", &parent_branch])
        .current_dir(&worktree_path)
        .output();

    let mut files_changed: u32 = 0;
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;

    if let Ok(output) = diff_stat_output {
        if output.status.success() {
            let stat_str = String::from_utf8_lossy(&output.stdout);
            // Parse the last line which contains summary: "X files changed, Y insertions(+), Z deletions(-)"
            if let Some(last_line) = stat_str.lines().last() {
                // Parse files changed
                if let Some(files_match) = last_line.split_whitespace().next() {
                    files_changed = files_match.parse().unwrap_or(0);
                }
                // Parse insertions
                if let Some(pos) = last_line.find("insertion") {
                    let before = &last_line[..pos];
                    if let Some(num_str) = before.split_whitespace().last() {
                        additions = num_str.parse().unwrap_or(0);
                    }
                }
                // Parse deletions
                if let Some(pos) = last_line.find("deletion") {
                    let before = &last_line[..pos];
                    if let Some(num_str) = before.split_whitespace().last() {
                        deletions = num_str.parse().unwrap_or(0);
                    }
                }
            }
        }
    }

    // Count commits since parent branch
    let commits_output = Command::new("git")
        .args(["rev-list", "--count", &format!("{}..HEAD", parent_branch)])
        .current_dir(&worktree_path)
        .output();

    let commits: u32 = if let Ok(output) = commits_output {
        if output.status.success() {
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse()
                .unwrap_or(0)
        } else {
            0
        }
    } else {
        0
    };

    // Check for uncommitted changes
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&worktree_path)
        .output();

    let has_uncommitted = if let Ok(output) = status_output {
        !output.stdout.is_empty()
    } else {
        false
    };

    CommandResult::ok(BranchStats {
        files_changed,
        additions,
        deletions,
        commits,
        has_uncommitted,
    })
}

/// Get list of changed files (uncommitted only) - lightweight, no diff content
#[tauri::command]
pub fn get_changed_files(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Vec<ChangedFile>> {
    let conn = db.conn.lock().unwrap();

    let worktree_path: Option<String> = match conn.query_row(
        "SELECT worktree_path FROM nodes WHERE id = ?1",
        [&node_id],
        |row| row.get(0),
    ) {
        Ok(path) => path,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => return CommandResult::err("Worktree not ready"),
    };

    let mut changed_files = Vec::new();

    // Get status with numstat for line counts
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&worktree_path)
        .output();

    // Get diff numstat for additions/deletions count
    let numstat_output = Command::new("git")
        .args(["diff", "HEAD", "--numstat"])
        .current_dir(&worktree_path)
        .output();

    // Parse numstat into a map
    let mut numstat_map: std::collections::HashMap<String, (u32, u32)> = std::collections::HashMap::new();
    if let Ok(output) = numstat_output {
        if output.status.success() {
            let numstat_str = String::from_utf8_lossy(&output.stdout);
            for line in numstat_str.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let adds = parts[0].parse().unwrap_or(0);
                    let dels = parts[1].parse().unwrap_or(0);
                    let filename = parts[2].to_string();
                    numstat_map.insert(filename, (adds, dels));
                }
            }
        }
    }

    if let Ok(status) = status_output {
        let status_str = String::from_utf8_lossy(&status.stdout);
        for line in status_str.lines() {
            if line.len() < 3 {
                continue;
            }
            let status_code = &line[..2];
            let filename = line[3..].to_string();

            let status = match status_code.trim() {
                "M" | "MM" | "AM" => "modified",
                "A" => "added",
                "D" => "deleted",
                "R" => "renamed",
                "??" => "untracked",
                _ => "modified", // Default to modified for other cases
            };

            let (additions, deletions) = numstat_map.get(&filename).copied().unwrap_or((0, 0));

            // For untracked files, count lines as additions
            let (additions, deletions) = if status == "untracked" {
                let file_path = Path::new(&worktree_path).join(&filename);
                if let Ok(content) = std::fs::read_to_string(&file_path) {
                    (content.lines().count() as u32, 0)
                } else {
                    (0, 0)
                }
            } else {
                (additions, deletions)
            };

            changed_files.push(ChangedFile {
                filename,
                status: status.to_string(),
                additions,
                deletions,
            });
        }
    }

    CommandResult::ok(changed_files)
}

/// Get list of changed files vs parent branch - lightweight, no diff content
#[tauri::command]
pub fn get_branch_changed_files(node_id: String, db: State<'_, Arc<Database>>) -> CommandResult<Vec<ChangedFile>> {
    let conn = db.conn.lock().unwrap();

    let (worktree_path, parent_branch): (Option<String>, Option<String>) = match conn.query_row(
        "SELECT worktree_path, parent_branch FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(result) => result,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => return CommandResult::err("Worktree not ready"),
    };

    let parent_branch = match parent_branch {
        Some(ref branch) if !branch.is_empty() => branch.clone(),
        _ => "main".to_string(),
    };

    let mut changed_files = Vec::new();

    // Get committed changes vs parent branch with numstat
    let numstat_output = Command::new("git")
        .args(["diff", "--numstat", &parent_branch])
        .current_dir(&worktree_path)
        .output();

    // Get name-status for status info
    let name_status_output = Command::new("git")
        .args(["diff", "--name-status", &parent_branch])
        .current_dir(&worktree_path)
        .output();

    // Parse numstat into a map
    let mut numstat_map: std::collections::HashMap<String, (u32, u32)> = std::collections::HashMap::new();
    if let Ok(output) = numstat_output {
        if output.status.success() {
            let numstat_str = String::from_utf8_lossy(&output.stdout);
            for line in numstat_str.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 3 {
                    let adds = parts[0].parse().unwrap_or(0);
                    let dels = parts[1].parse().unwrap_or(0);
                    let filename = parts[2].to_string();
                    numstat_map.insert(filename, (adds, dels));
                }
            }
        }
    }

    // Parse name-status for file statuses
    if let Ok(output) = name_status_output {
        if output.status.success() {
            let name_status_str = String::from_utf8_lossy(&output.stdout);
            for line in name_status_str.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    let status_code = parts[0];
                    let filename = parts[1].to_string();

                    let status = match status_code {
                        "M" => "modified",
                        "A" => "added",
                        "D" => "deleted",
                        s if s.starts_with("R") => "renamed",
                        _ => "modified",
                    };

                    let (additions, deletions) = numstat_map.get(&filename).copied().unwrap_or((0, 0));

                    changed_files.push(ChangedFile {
                        filename,
                        status: status.to_string(),
                        additions,
                        deletions,
                    });
                }
            }
        }
    }

    // Also include untracked files
    let status_output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&worktree_path)
        .output();

    if let Ok(status) = status_output {
        let status_str = String::from_utf8_lossy(&status.stdout);
        for line in status_str.lines() {
            if line.starts_with("?? ") {
                let filename = line[3..].to_string();
                let file_path = Path::new(&worktree_path).join(&filename);

                let additions = if let Ok(content) = std::fs::read_to_string(&file_path) {
                    content.lines().count() as u32
                } else {
                    0
                };

                changed_files.push(ChangedFile {
                    filename,
                    status: "untracked".to_string(),
                    additions,
                    deletions: 0,
                });
            }
        }
    }

    CommandResult::ok(changed_files)
}

/// Get diff for a single file (uncommitted changes)
#[tauri::command]
pub fn get_file_diff(node_id: String, filename: String, db: State<'_, Arc<Database>>) -> CommandResult<String> {
    let conn = db.conn.lock().unwrap();

    let worktree_path: Option<String> = match conn.query_row(
        "SELECT worktree_path FROM nodes WHERE id = ?1",
        [&node_id],
        |row| row.get(0),
    ) {
        Ok(path) => path,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => return CommandResult::err("Worktree not ready"),
    };

    // Check if file is untracked
    let status_output = Command::new("git")
        .args(["status", "--porcelain", &filename])
        .current_dir(&worktree_path)
        .output();

    let is_untracked = if let Ok(status) = &status_output {
        String::from_utf8_lossy(&status.stdout).starts_with("??")
    } else {
        false
    };

    if is_untracked {
        // Generate diff for untracked file
        let file_path = Path::new(&worktree_path).join(&filename);
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            let mut diff = String::new();
            diff.push_str(&format!("diff --git a/{} b/{}\n", filename, filename));
            diff.push_str("new file mode 100644\n");
            diff.push_str("--- /dev/null\n");
            diff.push_str(&format!("+++ b/{}\n", filename));

            let lines: Vec<&str> = content.lines().collect();
            let line_count = lines.len();
            diff.push_str(&format!("@@ -0,0 +1,{} @@\n", line_count));

            for line in lines {
                diff.push_str(&format!("+{}\n", line));
            }
            return CommandResult::ok(diff);
        } else {
            return CommandResult::err("Failed to read file");
        }
    }

    // Get diff for tracked file
    let output = Command::new("git")
        .args(["diff", "HEAD", "--", &filename])
        .current_dir(&worktree_path)
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                CommandResult::ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                CommandResult::err(&format!("Git diff failed: {}", stderr))
            }
        }
        Err(e) => CommandResult::err(&format!("Failed to run git: {}", e)),
    }
}

/// Get diff for a single file vs parent branch
#[tauri::command]
pub fn get_branch_file_diff(node_id: String, filename: String, db: State<'_, Arc<Database>>) -> CommandResult<String> {
    let conn = db.conn.lock().unwrap();

    let (worktree_path, parent_branch): (Option<String>, Option<String>) = match conn.query_row(
        "SELECT worktree_path, parent_branch FROM nodes WHERE id = ?1",
        [&node_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ) {
        Ok(result) => result,
        Err(_) => return CommandResult::err("Node not found"),
    };

    let worktree_path = match worktree_path {
        Some(path) if !path.is_empty() => path,
        _ => return CommandResult::err("Worktree not ready"),
    };

    let parent_branch = match parent_branch {
        Some(ref branch) if !branch.is_empty() => branch.clone(),
        _ => "main".to_string(),
    };

    // Check if file is untracked
    let status_output = Command::new("git")
        .args(["status", "--porcelain", &filename])
        .current_dir(&worktree_path)
        .output();

    let is_untracked = if let Ok(status) = &status_output {
        String::from_utf8_lossy(&status.stdout).starts_with("??")
    } else {
        false
    };

    if is_untracked {
        // Generate diff for untracked file
        let file_path = Path::new(&worktree_path).join(&filename);
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            let mut diff = String::new();
            diff.push_str(&format!("diff --git a/{} b/{}\n", filename, filename));
            diff.push_str("new file mode 100644\n");
            diff.push_str("--- /dev/null\n");
            diff.push_str(&format!("+++ b/{}\n", filename));

            let lines: Vec<&str> = content.lines().collect();
            let line_count = lines.len();
            diff.push_str(&format!("@@ -0,0 +1,{} @@\n", line_count));

            for line in lines {
                diff.push_str(&format!("+{}\n", line));
            }
            return CommandResult::ok(diff);
        } else {
            return CommandResult::err("Failed to read file");
        }
    }

    // Get diff for file vs parent branch
    let output = Command::new("git")
        .args(["diff", &parent_branch, "--", &filename])
        .current_dir(&worktree_path)
        .output();

    match output {
        Ok(output) => {
            if output.status.success() {
                CommandResult::ok(String::from_utf8_lossy(&output.stdout).to_string())
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                CommandResult::err(&format!("Git diff failed: {}", stderr))
            }
        }
        Err(e) => CommandResult::err(&format!("Failed to run git: {}", e)),
    }
}
