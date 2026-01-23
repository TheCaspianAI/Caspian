use super::NodeManifest;

/// Validation result for UI display
#[derive(Debug, Clone, serde::Serialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl ValidationResult {
    pub fn valid() -> Self {
        Self {
            is_valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    pub fn add_error(&mut self, error: &str) {
        self.errors.push(error.into());
        self.is_valid = false;
    }
}

/// Validate a manifest
pub fn validate_manifest(manifest: &NodeManifest) -> ValidationResult {
    let mut result = ValidationResult::valid();

    // Required fields
    if manifest.node_id.trim().is_empty() {
        result.add_error("Node ID is required");
    }

    if manifest.parent.trim().is_empty() {
        result.add_error("Parent branch is required");
    }

    if manifest.goal.trim().is_empty() {
        result.add_error("Goal is required");
    }

    // Check for empty ground rules
    for (i, rule) in manifest.ground_rules.iter().enumerate() {
        if rule.trim().is_empty() {
            result.add_error(&format!("Ground rule {} is empty", i + 1));
        }
    }

    result
}
