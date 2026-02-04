import type * as React from "react";

import { cn } from "../../lib/utils";

type InputVariant = "default" | "ghost";

interface InputProps extends React.ComponentProps<"input"> {
	variant?: InputVariant;
}

function Input({ className, type, variant = "default", ...props }: InputProps) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-lg px-3 py-2 text-sm",
				"text-foreground placeholder:text-muted-foreground",
				"transition-all duration-200 ease-out",
				"focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
				"aria-invalid:border-destructive",
				variant === "default" && "bg-input border border-border",
				variant === "ghost" && "bg-transparent border-none",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
