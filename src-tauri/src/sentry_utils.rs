use sentry::{Breadcrumb, Level};
use std::collections::BTreeMap;

/// Initialize Sentry with proper configuration
pub fn init_sentry() -> sentry::ClientInitGuard {
    sentry::init((
        "https://8cd35269848f855eeeff1f8a722f9a4e@o4510710267183105.ingest.us.sentry.io/4510710273474560",
        sentry::ClientOptions {
            release: sentry::release_name!(),
            send_default_pii: true,
            // Capture 100% of transactions for performance monitoring
            traces_sample_rate: 1.0,
            // Attach stacktraces to messages
            attach_stacktrace: true,
            ..Default::default()
        },
    ))
}

/// Capture an error with context
pub fn capture_error<E: std::fmt::Display>(error: &E, context: &str) {
    sentry::with_scope(
        |scope| {
            scope.set_tag("context", context);
        },
        || {
            sentry::capture_message(
                &format!("{}: {}", context, error),
                Level::Error,
            );
        },
    );
}

/// Capture an error with additional data
pub fn capture_error_with_data<E: std::fmt::Display>(
    error: &E,
    context: &str,
    data: BTreeMap<String, String>,
) {
    sentry::with_scope(
        |scope| {
            scope.set_tag("context", context);
            for (key, value) in &data {
                scope.set_extra(key, serde_json::json!(value).into());
            }
        },
        || {
            sentry::capture_message(
                &format!("{}: {}", context, error),
                Level::Error,
            );
        },
    );
}

/// Add a breadcrumb for tracking user actions
pub fn add_breadcrumb(category: &str, message: &str, level: Level) {
    sentry::add_breadcrumb(Breadcrumb {
        category: Some(category.to_string()),
        message: Some(message.to_string()),
        level,
        ..Default::default()
    });
}

/// Add a breadcrumb with additional data
pub fn add_breadcrumb_with_data(
    category: &str,
    message: &str,
    level: Level,
    data: BTreeMap<String, serde_json::Value>,
) {
    sentry::add_breadcrumb(Breadcrumb {
        category: Some(category.to_string()),
        message: Some(message.to_string()),
        level,
        data,
        ..Default::default()
    });
}

/// Set user context for Sentry
pub fn set_user(user_id: Option<&str>, username: Option<&str>, email: Option<&str>) {
    sentry::configure_scope(|scope| {
        if user_id.is_some() || username.is_some() || email.is_some() {
            scope.set_user(Some(sentry::User {
                id: user_id.map(|s| s.to_string()),
                username: username.map(|s| s.to_string()),
                email: email.map(|s| s.to_string()),
                ..Default::default()
            }));
        } else {
            scope.set_user(None);
        }
    });
}

/// Clear user context (on sign out)
pub fn clear_user() {
    sentry::configure_scope(|scope| {
        scope.set_user(None);
    });
}

/// Set a tag that will be attached to all events
pub fn set_tag(key: &str, value: &str) {
    sentry::configure_scope(|scope| {
        scope.set_tag(key, value);
    });
}

/// Capture a warning message
pub fn capture_warning(message: &str) {
    sentry::capture_message(message, Level::Warning);
}

/// Capture an info message
pub fn capture_info(message: &str) {
    sentry::capture_message(message, Level::Info);
}

// Helper macros for common patterns

/// Macro to capture command errors and return CommandResult
#[macro_export]
macro_rules! capture_and_return_err {
    ($context:expr, $error:expr) => {{
        $crate::sentry_utils::capture_error(&$error, $context);
        CommandResult::err(&$error.to_string())
    }};
}

/// Macro to add a breadcrumb before an operation
#[macro_export]
macro_rules! breadcrumb {
    ($category:expr, $message:expr) => {
        $crate::sentry_utils::add_breadcrumb($category, $message, sentry::Level::Info);
    };
    ($category:expr, $message:expr, $level:expr) => {
        $crate::sentry_utils::add_breadcrumb($category, $message, $level);
    };
}
