import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "ui/components/ui/collapsible";
import { cn } from "ui/lib/utils";
import type { ReactNode } from "react";
import { HiChevronRight } from "react-icons/hi2";

interface CategorySectionProps {
	title: string;
	count: number;
	isExpanded: boolean;
	onToggle: () => void;
	children: ReactNode;
	actions?: ReactNode;
}

export function CategorySection({
	title,
	count,
	isExpanded,
	onToggle,
	children,
	actions,
}: CategorySectionProps) {
	if (count === 0) {
		return null;
	}

	return (
		<Collapsible
			open={isExpanded}
			onOpenChange={onToggle}
			className="min-w-0 overflow-hidden"
		>
			<div className="group flex items-center min-w-0">
				<CollapsibleTrigger
					className={cn(
						"flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0",
						"hover:bg-accent/30 cursor-pointer transition-colors",
					)}
				>
					<HiChevronRight
						className={cn(
							"size-3 text-muted-foreground shrink-0 transition-transform duration-150",
							isExpanded && "rotate-90",
						)}
					/>
					<span className="text-label font-medium truncate">{title}</span>
					<span className="text-caption text-muted-foreground shrink-0">
						{count}
					</span>
				</CollapsibleTrigger>
				{actions && <div className="pr-1.5 shrink-0">{actions}</div>}
			</div>

			<CollapsibleContent className="px-0.5 pb-1 min-w-0 overflow-hidden">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
