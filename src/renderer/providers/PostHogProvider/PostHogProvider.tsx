import { PostHogProvider as PHProvider } from "posthog-js/react";
import type React from "react";
import { useEffect, useState } from "react";
import { initPostHog, posthog } from "renderer/lib/posthog";

interface PostHogProviderProps {
	children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
	const [isInitialized, setIsInitialized] = useState(false);

	useEffect(() => {
		initPostHog();
		// Only capture if posthog is enabled
		if (posthog) {
			posthog.capture("desktop_opened");
		}
		setIsInitialized(true);
	}, []);

	// Don't render children until initialized
	if (!isInitialized) {
		return null;
	}

	// If PostHog is disabled (null), just render children without the provider
	if (!posthog) {
		return <>{children}</>;
	}

	return <PHProvider client={posthog}>{children}</PHProvider>;
}
