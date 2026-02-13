"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "../../lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn("flex flex-col gap-2", className)}
			{...props}
		/>
	);
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn(
				"bg-accent/30 text-muted-foreground inline-flex h-8 w-fit items-center justify-center rounded-[8px] p-[3px] border border-border/20",
				className,
			)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"data-[state=active]:bg-accent data-[state=active]:text-foreground",
				"text-muted-foreground",
				"focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
				"inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5",
				"rounded-[6px] border border-transparent px-2.5 py-1 text-[13px] font-medium",
				"whitespace-nowrap transition-colors duration-[80ms]",
				"disabled:pointer-events-none disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
