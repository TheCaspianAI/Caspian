import type * as React from "react";

import { cn } from "../../lib/utils";

function Input({
	className,
	type,
	...props
}: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 rounded-lg px-3 py-2 text-sm",
				"bg-input border border-border",
				"text-foreground placeholder:text-muted-foreground",
				"transition-colors duration-150",
				"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
				"disabled:cursor-not-allowed disabled:opacity-50",
				"file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
				"aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
