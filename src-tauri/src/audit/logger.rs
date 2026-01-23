use super::{AuditEntry, AuditResult};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

/// Get the audit directory for a repository
pub fn get_audit_dir(repo_path: &Path) -> PathBuf {
    let mut path = repo_path.to_path_buf();
    path.push(".caspian");
    path.push("audit");
    path
}

/// Get the audit log path for a branch
pub fn get_audit_path(repo_path: &Path, node_id: &str) -> PathBuf {
    let mut path = get_audit_dir(repo_path);
    // Sanitize node_id: replace / with _ to avoid creating subdirectories
    let safe_node_id = node_id.replace('/', "_");
    path.push(format!("{}.jsonl", safe_node_id));
    path
}

/// Append an entry to the audit log (append-only)
pub fn append_audit_entry(repo_path: &Path, entry: &AuditEntry) -> AuditResult<()> {
    let audit_dir = get_audit_dir(repo_path);
    fs::create_dir_all(&audit_dir)?;

    let path = get_audit_path(repo_path, &entry.node_id);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)?;

    let json = serde_json::to_string(entry)?;
    writeln!(file, "{}", json)?;

    Ok(())
}

/// Read all audit entries for a branch
pub fn read_audit_log(repo_path: &Path, node_id: &str) -> AuditResult<Vec<AuditEntry>> {
    let path = get_audit_path(repo_path, node_id);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&path)?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for line in reader.lines() {
        let line = line?;
        if !line.trim().is_empty() {
            let entry: AuditEntry = serde_json::from_str(&line)?;
            entries.push(entry);
        }
    }

    Ok(entries)
}

/// Get recent activity across all branches in a repository
pub fn get_recent_activity(repo_path: &Path, limit: usize) -> AuditResult<Vec<AuditEntry>> {
    let audit_dir = get_audit_dir(repo_path);

    if !audit_dir.exists() {
        return Ok(Vec::new());
    }

    let mut all_entries = Vec::new();

    for entry in fs::read_dir(&audit_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
            if let Ok(entries) = read_audit_log_from_path(&path) {
                all_entries.extend(entries);
            }
        }
    }

    // Sort by timestamp descending
    all_entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    // Limit results
    all_entries.truncate(limit);

    Ok(all_entries)
}

fn read_audit_log_from_path(path: &Path) -> AuditResult<Vec<AuditEntry>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for line in reader.lines() {
        let line = line?;
        if !line.trim().is_empty() {
            let entry: AuditEntry = serde_json::from_str(&line)?;
            entries.push(entry);
        }
    }

    Ok(entries)
}

/// Delete audit log for a branch
pub fn delete_audit_log(repo_path: &Path, node_id: &str) -> AuditResult<()> {
    let path = get_audit_path(repo_path, node_id);

    if path.exists() {
        fs::remove_file(&path)?;
    }

    Ok(())
}
