import { LuChevronRight, LuRadioTower } from "react-icons/lu";
import { usePortsStore } from "renderer/stores/ports";
import { NodePortGroup } from "./components/NodePortGroup";
import { usePortsData } from "./hooks/usePortsData";

export function PortsList() {
	const isCollapsed = usePortsStore((s) => s.isListCollapsed);
	const toggleCollapsed = usePortsStore((s) => s.toggleListCollapsed);

	const { nodePortGroups, totalPortCount } = usePortsData();

	if (totalPortCount === 0) {
		return null;
	}

	return (
		<div className="pt-3 border-t border-border">
			<div className="group text-[11px] uppercase tracking-wider text-muted-foreground/70 px-3 pb-2 font-medium flex items-center gap-1.5 w-full hover:text-muted-foreground transition-colors">
				<button
					type="button"
					aria-expanded={!isCollapsed}
					onClick={toggleCollapsed}
					className="flex items-center gap-1.5 focus-visible:text-muted-foreground focus-visible:outline-none"
				>
					<LuChevronRight
						className={`size-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
					/>
					<LuRadioTower className="size-3" />
					Ports
				</button>
				<span className="ml-auto text-[10px] font-normal">{totalPortCount}</span>
			</div>
			{!isCollapsed && (
				<div className="space-y-2 max-h-72 overflow-y-auto pb-1 hide-scrollbar">
					{nodePortGroups.map((group) => (
						<NodePortGroup key={group.nodeId} group={group} />
					))}
				</div>
			)}
		</div>
	);
}
