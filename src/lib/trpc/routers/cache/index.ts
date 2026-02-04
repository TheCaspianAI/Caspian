import { session } from "electron";
import { publicProcedure, router } from "../..";

const API_URL = "https://api.trycaspianai.com";

export const createCacheRouter = () => {
	return router({
		clearElectricCache: publicProcedure.mutation(async () => {
			try {
				// Clear all storage (including HTTP cache) for the API origin only
				// This targets Electric shape responses without clearing app assets
				await session.defaultSession.clearStorageData({
					origin: API_URL,
				});

				console.log("[cache] Cleared Electric cache for origin:", API_URL);

				return { success: true };
			} catch (error) {
				console.error("[cache] Failed to clear Electric cache:", error);
				return {
					success: false,
					error: error instanceof Error ? error.message : "Failed to clear cache",
				};
			}
		}),
	});
};

export type CacheRouter = ReturnType<typeof createCacheRouter>;
