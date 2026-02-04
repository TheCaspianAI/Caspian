import { ContextHeader } from "./ContextHeader";
import { FilesChangesPane } from "./FilesChangesPane";
import { SystemNav } from "./SystemNav";

export function ContextRail() {
	return (
		<aside className="flex flex-col h-full overflow-hidden pt-3 pl-3">
			<ContextHeader />
			<FilesChangesPane />
			<SystemNav />
		</aside>
	);
}
