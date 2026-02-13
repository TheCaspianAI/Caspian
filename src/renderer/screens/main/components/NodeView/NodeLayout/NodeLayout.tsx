import { ScrollProvider } from "../ChangesContent";
import { ContentView } from "../ContentView";

export function NodeLayout() {
	return (
		<ScrollProvider>
			<div className="flex-1 min-w-0 overflow-hidden">
				<ContentView />
			</div>
		</ScrollProvider>
	);
}
