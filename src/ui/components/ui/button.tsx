import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-medium",
		"rounded-[6px] transition-colors duration-[80ms] cursor-pointer",
		"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
	],
	{
		variants: {
			variant: {
				// Primary — white fill, dark text, no glow
				default: [
					"bg-primary text-primary-foreground",
					"hover:bg-primary/85",
					"active:bg-primary/75",
				],
				// Secondary — transparent fill, secondary text, border
				secondary: [
					"bg-transparent text-muted-foreground border border-border",
					"hover:bg-accent hover:text-accent-foreground",
				],
				// Outline — same as secondary
				outline: [
					"border border-border bg-transparent text-foreground",
					"hover:bg-accent hover:text-accent-foreground",
				],
				// Ghost — no fill, no border
				ghost: ["text-muted-foreground", "hover:bg-accent hover:text-accent-foreground"],
				// Destructive — transparent fill, error text, border
				destructive: [
					"bg-transparent text-destructive border border-border",
					"hover:bg-destructive/10",
				],
				// Link
				link: ["text-foreground underline-offset-4", "hover:underline"],
			},
			size: {
				default: "h-8 px-3.5 py-1.5",
				sm: "h-7 px-2.5 text-xs",
				lg: "h-9 px-5",
				icon: "size-8",
				"icon-sm": "size-7",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
