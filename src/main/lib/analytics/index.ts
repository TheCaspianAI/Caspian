// import { app } from "electron";
// import { PostHog } from "posthog-node";

// PostHog analytics - currently disabled
// To enable, uncomment the code below and set POSTHOG_KEY

// const POSTHOG_KEY = "";
// const POSTHOG_HOST = "https://us.i.posthog.com";

// export let posthog: PostHog | null = null;
// let userId: string | null = null;

// function getClient(): PostHog | null {
// 	if (!POSTHOG_KEY) {
// 		return null;
// 	}

// 	if (!posthog) {
// 		posthog = new PostHog(POSTHOG_KEY, {
// 			host: POSTHOG_HOST,
// 			flushAt: 1,
// 			flushInterval: 0,
// 		});
// 	}
// 	return posthog;
// }

export function setUserId(_id: string | null): void {
	// userId = id;
}

export function track(_event: string, _properties?: Record<string, unknown>): void {
	// if (!userId) return;
	// const client = getClient();
	// if (!client) return;
	// client.capture({
	// 	distinctId: userId,
	// 	event,
	// 	properties: {
	// 		...properties,
	// 		app_name: "desktop",
	// 		platform: process.platform,
	// 		desktop_version: app.getVersion(),
	// 	},
	// });
}
