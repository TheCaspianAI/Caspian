import { cn } from "../../lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"bg-accent/40 text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-[4px] px-1.5 font-sans text-xs font-medium select-none border border-border/20",
				"[&_svg:not([class*='size-'])]:size-3",
				"[[data-slot=tooltip-content]_&]:bg-foreground/10 [[data-slot=tooltip-content]_&]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<kbd
			data-slot="kbd-group"
			className={cn("inline-flex items-center gap-1", className)}
			{...props}
		/>
	);
}

export { Kbd, KbdGroup };
