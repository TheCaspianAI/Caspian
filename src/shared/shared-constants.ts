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

// PostHog
export const POSTHOG_COOKIE_NAME = "caspian";

export const FEATURE_FLAGS = {
	/** Gates access to experimental Electric SQL tasks feature. */
	ELECTRIC_TASKS_ACCESS: "electric-tasks-access",
	/** Gates access to GitHub integration (currently buggy, internal only). */
	GITHUB_INTEGRATION_ACCESS: "github-integration-access",
} as const;
