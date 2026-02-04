// import * as Sentry from "@sentry/electron/main";
// import { IPCMode } from "@sentry/electron/main";
// import { session } from "electron";

// Sentry error tracking - currently disabled
// To enable, uncomment the code below and set SENTRY_DSN

// const SENTRY_DSN = "";

// let sentryInitialized = false;

export function initSentry(): void {
	// if (sentryInitialized) return;
	// if (!SENTRY_DSN || process.env.NODE_ENV !== "production") {
	// 	return;
	// }
	// try {
	// 	Sentry.init({
	// 		dsn: SENTRY_DSN,
	// 		environment: process.env.NODE_ENV,
	// 		tracesSampleRate: 0.1,
	// 		sendDefaultPii: false,
	// 		ipcMode: IPCMode.Classic,
	// 		getSessions: () => [
	// 			session.defaultSession,
	// 			session.fromPartition("persist:caspian"),
	// 		],
	// 	});
	// 	sentryInitialized = true;
	// 	console.log("[sentry] Initialized in main process");
	// } catch (error) {
	// 	console.error("[sentry] Failed to initialize in main:", error);
	// }
}
