import type { PostHog } from "posthog-js";

// PostHog analytics - currently disabled
// To enable, uncomment the code below and set POSTHOG_KEY

// import posthogFull from "posthog-js/dist/module.full.no-external";
// const POSTHOG_KEY = "";
// const POSTHOG_HOST = "https://us.i.posthog.com";

// Cast to standard PostHog type for compatibility with posthog-js/react
// export const posthog = posthogFull as unknown as PostHog;
export const posthog: PostHog | null = null;

export function initPostHog() {
	// if (!POSTHOG_KEY) {
	// 	console.log("[posthog] No key configured, skipping");
	// 	return;
	// }
	// posthogFull.init(POSTHOG_KEY, {
	// 	api_host: POSTHOG_HOST,
	// 	defaults: "2025-11-30",
	// 	capture_pageview: false,
	// 	capture_pageleave: false,
	// 	capture_exceptions: true,
	// 	person_profiles: "identified_only",
	// 	persistence: "localStorage",
	// 	debug: false,
	// 	loaded: (ph) => {
	// 		ph.register({
	// 			app_name: "desktop",
	// 			platform: window.navigator.platform,
	// 		});
	// 	},
	// });
}
