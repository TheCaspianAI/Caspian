use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeState {
    InProgress,
    ReadyForReview,
    Approved,
    Closed,
}

impl NodeState {
    pub fn as_str(&self) -> &'static str {
        match self {
            NodeState::InProgress => "in_progress",
            NodeState::ReadyForReview => "ready_for_review",
            NodeState::Approved => "approved",
            NodeState::Closed => "closed",
        }
    }
}

impl Default for NodeState {
    fn default() -> Self {
        NodeState::InProgress
    }
}
