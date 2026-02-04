// Sentry error tracking - currently disabled
// To enable, uncomment the code below and set SENTRY_DSN

// const SENTRY_DSN = "";

// let sentryInitialized = false;

export async function initSentry(): Promise<void> {
	// if (sentryInitialized) return;
	// if (!SENTRY_DSN || process.env.NODE_ENV !== "production") {
	// 	return;
	// }
	// try {
	// 	// Dynamic import to avoid bundler issues
	// 	const Sentry = await import("@sentry/electron/renderer");
	// 	Sentry.init({
	// 		dsn: SENTRY_DSN,
	// 		environment: process.env.NODE_ENV,
	// 		tracesSampleRate: 0.1,
	// 		replaysSessionSampleRate: 0.1,
	// 		replaysOnErrorSampleRate: 1.0,
	// 	});
	// 	sentryInitialized = true;
	// 	console.log("[sentry] Initialized in renderer process");
	// } catch (error) {
	// 	console.error("[sentry] Failed to initialize in renderer:", error);
	// }
}
