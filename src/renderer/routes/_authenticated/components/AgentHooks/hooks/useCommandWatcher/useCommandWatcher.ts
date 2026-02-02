/**
 * Command watcher hook - currently a no-op since cloud features are disabled.
 * Kept for future cloud functionality.
 */
export function useCommandWatcher() {
	return {
		isWatching: false,
		deviceId: null,
		pendingCount: 0,
	};
}
