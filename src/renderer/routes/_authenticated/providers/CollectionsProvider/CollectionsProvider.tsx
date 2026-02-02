import { createContext, type ReactNode, useContext } from "react";

/**
 * Collections context - currently stubbed since cloud features are disabled.
 * Kept for future cloud functionality.
 */

type Collections = Record<string, never>;

const CollectionsContext = createContext<Collections | null>(null);

export function CollectionsProvider({ children }: { children: ReactNode }) {
	return (
		<CollectionsContext.Provider value={{}}>
			{children}
		</CollectionsContext.Provider>
	);
}

export function useCollections(): Collections {
	const context = useContext(CollectionsContext);
	if (!context) {
		throw new Error("useCollections must be used within CollectionsProvider");
	}
	return context;
}
