use super::{NodeManifest, ManifestError, ManifestResult};
use std::fs;
use std::path::{Path, PathBuf};

/// Get the manifests directory for a repository
pub fn get_manifests_dir(repo_path: &Path) -> PathBuf {
    let mut path = repo_path.to_path_buf();
    path.push(".caspian");
    path.push("manifests");
    path
}

/// Get the manifest file path for a node
pub fn get_manifest_path(repo_path: &Path, node_id: &str) -> PathBuf {
    let mut path = get_manifests_dir(repo_path);
    // Sanitize node_id: replace / with _ to avoid creating subdirectories
    let safe_node_id = node_id.replace('/', "_");
    path.push(format!("{}.yaml", safe_node_id));
    path
}

/// Parse a manifest from YAML string
pub fn parse_manifest(yaml: &str) -> ManifestResult<NodeManifest> {
    Ok(serde_yaml::from_str(yaml)?)
}

/// Load a manifest from file
pub fn load_manifest(repo_path: &Path, node_id: &str) -> ManifestResult<NodeManifest> {
    let path = get_manifest_path(repo_path, node_id);

    if !path.exists() {
        return Err(ManifestError::NotFound(path.display().to_string()));
    }

    let content = fs::read_to_string(&path)?;
    parse_manifest(&content)
}

/// Save a manifest to file
pub fn save_manifest(repo_path: &Path, manifest: &NodeManifest) -> ManifestResult<()> {
    let manifests_dir = get_manifests_dir(repo_path);
    fs::create_dir_all(&manifests_dir)?;

    let path = get_manifest_path(repo_path, &manifest.node_id);
    let yaml = serde_yaml::to_string(manifest)?;
    fs::write(&path, yaml)?;

    Ok(())
}

/// Delete a manifest file
pub fn delete_manifest(repo_path: &Path, node_id: &str) -> ManifestResult<()> {
    let path = get_manifest_path(repo_path, node_id);

    if path.exists() {
        fs::remove_file(&path)?;
    }

    Ok(())
}

/// Detect test framework and return appropriate command
pub fn detect_test_command(repo_path: &Path) -> Option<String> {
    let files_to_check = [
        ("package.json", "npm test"),
        ("jest.config.js", "npm test"),
        ("jest.config.ts", "npm test"),
        ("vitest.config.js", "npm test"),
        ("vitest.config.ts", "npm test"),
        ("pytest.ini", "pytest"),
        ("pyproject.toml", "pytest"),
        ("setup.py", "python -m pytest"),
        ("Cargo.toml", "cargo test"),
        ("go.mod", "go test ./..."),
    ];

    for (file, command) in files_to_check {
        if repo_path.join(file).exists() {
            return Some(command.into());
        }
    }

    None
}
