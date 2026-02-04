import { SidebarMode, useSidebarStore } from "renderer/stores/sidebar-state";
import { ChangesContent, ScrollProvider } from "../ChangesContent";
import { ContentView } from "../ContentView";

export function NodeLayout() {
	const { currentMode } = useSidebarStore();

	const isExpanded = currentMode === SidebarMode.Changes;

	return (
		<ScrollProvider>
			<div className="flex-1 min-w-0 overflow-hidden">
				{isExpanded ? <ChangesContent /> : <ContentView />}
			</div>
		</ScrollProvider>
	);
}
