use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Notification count for a node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationCount {
    pub node_id: String,
    pub unread_count: u32,
    pub requires_input: bool,
    pub last_notification_at: Option<DateTime<Utc>>,
    pub last_viewed_at: Option<DateTime<Utc>>,
}

/// Event payload for notification state updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationUpdateEvent {
    pub node_id: String,
    pub count: u32,
    pub requires_input: bool,
}
