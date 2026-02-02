// Auth
export const AUTH_PROVIDERS = ["github", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

// Deep link protocol schemes (used for desktop OAuth callbacks)
export const PROTOCOL_SCHEMES = {
	DEV: "caspian-dev",
	PROD: "caspian",
} as const;

// Company
export const COMPANY = {
	NAME: "CaspianAI",
	DOMAIN: "trycaspianai.com",
	EMAIL_DOMAIN: "@trycaspianai.com",
	GITHUB_URL: "https://github.com/TheCaspianAI/Caspian",
	DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.trycaspianai.com",
	MARKETING_URL: process.env.NEXT_PUBLIC_MARKETING_URL || "https://trycaspianai.com",
	TERMS_URL: `${process.env.NEXT_PUBLIC_MARKETING_URL || "https://trycaspianai.com"}/terms`,
	PRIVACY_URL:
		(process.env.NEXT_PUBLIC_MARKETING_URL || "https://trycaspianai.com") +
		"/privacy",
	CHANGELOG_URL:
		(process.env.NEXT_PUBLIC_MARKETING_URL || "https://trycaspianai.com") +
		"/changelog",
	X_URL: "https://x.com/trycaspianai",
	MAIL_TO: "mailto:adarsh.bhardwaj2020@gmail.com",
	REPORT_ISSUE_URL: "https://github.com/TheCaspianAI/Caspian/issues/new",
	DISCORD_URL: "https://discord.gg/cZeD9WYcV7",
} as const;

// Theme
export const THEME_STORAGE_KEY = "caspian-theme";

// Download URLs
export const DOWNLOAD_URL_MAC_ARM64 = `${COMPANY.GITHUB_URL}/releases/latest/download/Caspian-arm64.dmg`;

// Auth token configuration
export const TOKEN_CONFIG = {
	/** Access token lifetime in seconds (1 hour) */
	ACCESS_TOKEN_EXPIRY: 60 * 60,
	/** Refresh token lifetime in seconds (30 days) */
	REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60,
	/** Refresh access token when this many seconds remain (5 minutes) */
	REFRESH_THRESHOLD: 5 * 60,
} as const;

// PostHog
export const POSTHOG_COOKIE_NAME = "caspian";

export const FEATURE_FLAGS = {
	/** Gates access to experimental Electric SQL tasks feature. */
	ELECTRIC_TASKS_ACCESS: "electric-tasks-access",
	/** Gates access to GitHub integration (currently buggy, internal only). */
	GITHUB_INTEGRATION_ACCESS: "github-integration-access",
} as const;
