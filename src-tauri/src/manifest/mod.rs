mod parser;
mod validator;

pub use parser::*;
pub use validator::*;

use crate::state::NodeState;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ManifestError {
    #[error("YAML parse error: {0}")]
    YamlError(#[from] serde_yaml::Error),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Manifest not found at: {0}")]
    NotFound(String),
}

pub type ManifestResult<T> = Result<T, ManifestError>;

/// Agent information in manifest
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AgentInfo {
    pub model: Option<String>,
    pub session_id: Option<String>,
}

/// Test configuration in manifest
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TestConfig {
    #[serde(default)]
    pub required: Vec<String>,
    pub command: Option<String>,
}

/// Status information in manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusInfo {
    pub state: NodeState,
    pub transitioned_at: DateTime<Utc>,
    pub transitioned_by: String,
    pub close_reason: Option<String>,
}

impl Default for StatusInfo {
    fn default() -> Self {
        Self {
            state: NodeState::InProgress,
            transitioned_at: Utc::now(),
            transitioned_by: "human".into(),
            close_reason: None,
        }
    }
}

/// Node manifest - the core data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeManifest {
    pub node_id: String,
    pub parent: String,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub agent: AgentInfo,
    pub goal: String,
    #[serde(default)]
    pub ground_rules: Vec<String>,
    #[serde(default)]
    pub conflicts_with: Vec<String>,
    #[serde(default)]
    pub tests: TestConfig,
    #[serde(default)]
    pub status: StatusInfo,
}

impl NodeManifest {
    /// Create a new manifest with default values
    pub fn new(node_id: &str, parent: &str, goal: &str) -> Self {
        Self {
            node_id: node_id.into(),
            parent: parent.into(),
            created_at: Utc::now(),
            agent: AgentInfo::default(),
            goal: goal.into(),
            ground_rules: Vec::new(),
            conflicts_with: Vec::new(),
            tests: TestConfig::default(),
            status: StatusInfo::default(),
        }
    }

    /// Add a ground rule (constraint)
    pub fn add_ground_rule(&mut self, rule: &str) {
        if !rule.trim().is_empty() {
            self.ground_rules.push(rule.trim().into());
        }
    }
}
