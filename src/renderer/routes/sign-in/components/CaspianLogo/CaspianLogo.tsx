import { cn } from "ui/lib/utils";

interface CaspianLogoProps {
	className?: string;
}

export function CaspianLogo({ className }: CaspianLogoProps) {
	return (
		<div
			className={cn("text-foreground text-5xl font-bold tracking-tight", className)}
			aria-label="Caspian"
		>
			Caspian
		</div>
	);
}
