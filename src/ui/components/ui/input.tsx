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
				"h-8 w-full min-w-0 rounded-[6px] px-3 py-1.5 text-[13px]",
				"text-foreground placeholder:text-muted-foreground",
				"transition-colors duration-[80ms]",
				"focus:outline-none focus:border-ring",
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
