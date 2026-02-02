/**
 * Device presence hook - currently a no-op since auth/cloud features are disabled.
 * Kept for future cloud functionality.
 */
export function useDevicePresence() {
	return {
		deviceInfo: null,
		isActive: false,
	};
}
