mod logger;

pub use logger::*;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuditError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
}

pub type AuditResult<T> = Result<T, AuditError>;

/// Types of audit events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    BranchCreated,
    NodeCreated,  // New: for node-based workflow
    StateTransition,
    GoalChange,
    GroundRuleAdded,
    GroundRuleRemoved,
    GroundRuleEdited,
    TestsRun,
}

/// Single audit entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: DateTime<Utc>,
    pub event_type: AuditEventType,
    pub node_id: String,
    pub actor: String,
    pub previous_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub reason: Option<String>,
}

impl AuditEntry {
    pub fn new(event_type: AuditEventType, node_id: &str) -> Self {
        Self {
            timestamp: Utc::now(),
            event_type,
            node_id: node_id.into(),
            actor: "human".into(),
            previous_value: None,
            new_value: None,
            reason: None,
        }
    }

    pub fn with_values(
        mut self,
        previous: Option<serde_json::Value>,
        new: Option<serde_json::Value>,
    ) -> Self {
        self.previous_value = previous;
        self.new_value = new;
        self
    }
}
