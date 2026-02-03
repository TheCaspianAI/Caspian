import { forwardRef } from "react";
import { cn } from "ui/lib/utils";
import type { SettingsSection as SettingsSectionType } from "renderer/stores/settings-state";

interface SettingsSectionProps {
	id: SettingsSectionType;
	title: string;
	description?: string;
	children: React.ReactNode;
	className?: string;
	isFirst?: boolean;
}

export const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(
	function SettingsSection(
		{ id, title, description, children, className, isFirst },
		ref
	) {
		return (
			<section
				ref={ref}
				id={`settings-section-${id}`}
				data-settings-section={id}
				className={cn(
					"scroll-mt-4",
					!isFirst && "border-t border-border pt-6 mt-6",
					className
				)}
			>
				<div className="mb-4">
					<h2 className="text-base font-medium">{title}</h2>
					{description && (
						<p className="text-sm text-muted-foreground mt-0.5">
							{description}
						</p>
					)}
				</div>
				<div>{children}</div>
			</section>
		);
	}
);
