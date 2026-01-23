use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("GitHub API error: {0}")]
    GitHubApiError(String),
}

impl Serialize for AuthError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Current authentication status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "status")]
pub enum AuthStatus {
    /// Not authenticated
    #[serde(rename = "unauthenticated")]
    Unauthenticated,

    /// Authenticated with GitHub via gh CLI
    #[serde(rename = "authenticated")]
    Authenticated { user: GitHubUser },
}

/// GitHub user profile information (matches `gh api user` response)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GitHubUser {
    pub id: i64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}
