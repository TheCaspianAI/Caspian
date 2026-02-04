import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
	[
		"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium",
		"rounded-lg transition-colors duration-150 cursor-pointer",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
	],
	{
		variants: {
			variant: {
				// Primary - pink accent, subtle glow on hover only
				default: [
					"bg-primary text-primary-foreground",
					"hover:bg-primary/90",
					"hover:shadow-[0_0_16px_oklch(0.72_0.25_328_/_0.25)]",
				],
				// Secondary - muted background
				secondary: ["bg-secondary text-secondary-foreground", "hover:bg-secondary/70"],
				// Outline - border, transparent bg
				outline: [
					"border border-border bg-transparent text-foreground",
					"hover:bg-accent hover:text-accent-foreground",
				],
				// Ghost - no background until hover
				ghost: ["text-foreground", "hover:bg-accent hover:text-accent-foreground"],
				// Destructive
				destructive: ["bg-destructive text-destructive-foreground", "hover:bg-destructive/90"],
				// Link
				link: ["text-primary underline-offset-4", "hover:underline"],
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 px-3 text-xs",
				lg: "h-10 px-5",
				icon: "size-9",
				"icon-sm": "size-8",
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
