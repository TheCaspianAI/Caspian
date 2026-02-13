import { motion } from "framer-motion";
import { LuCheck, LuCircleX, LuTerminal, LuTriangleAlert } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { Button } from "ui/components/ui/button";
import { Spinner } from "ui/components/ui/spinner";

interface SetupCheckScreenProps {
	onContinue: () => void;
}

export function SetupCheckScreen({ onContinue }: SetupCheckScreenProps) {
	const { data, isLoading, isError } = electronTrpc.settings.getToolStatus.useQuery();

	return (
		<div className="flex-1 h-full flex flex-col items-center justify-center bg-background px-6">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
				className="max-w-lg w-full"
			>
				<motion.h1
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="text-2xl font-semibold text-foreground tracking-tight mb-2 text-center"
				>
					Environment Setup
				</motion.h1>

				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="text-sm text-muted-foreground mb-8 text-center"
				>
					Checking the tools Caspian uses to manage your projects.
				</motion.p>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
					className="space-y-3 mb-8"
				>
					{isLoading ? (
						<div className="flex items-center justify-center gap-3 py-8">
							<Spinner className="size-5" />
							<span className="text-sm text-muted-foreground">Checking your tools...</span>
						</div>
					) : isError ? (
						<div className="flex items-center justify-center gap-3 py-8">
							<span className="text-sm text-muted-foreground">
								Could not check tool status. You can continue and set up later.
							</span>
						</div>
					) : data ? (
						<>
							<GitStatus available={data.git.available} />
							<GhStatus
								installed={data.gh.installed}
								authenticated={data.gh.authenticated}
								username={data.gh.username}
							/>
						</>
					) : null}
				</motion.div>

				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.5 }}
					className="flex flex-col items-center gap-3"
				>
					<Button size="lg" onClick={onContinue} className="px-8 py-6 text-base">
						Continue
					</Button>
					<span className="text-xs text-muted-foreground/60">
						GitHub CLI is optional. You can set it up later.
					</span>
				</motion.div>
			</motion.div>
		</div>
	);
}

function GitStatus({ available }: { available: boolean }) {
	if (available) {
		return (
			<StatusRow
				icon={<LuCheck className="w-4 h-4 text-emerald-400" />}
				label="Git"
				description="Installed"
				variant="success"
			/>
		);
	}

	return (
		<StatusRow
			icon={<LuCircleX className="w-4 h-4 text-red-400" />}
			label="Git"
			description="Not found. Git is required for Caspian to work."
			variant="error"
		/>
	);
}

function GhStatus({
	installed,
	authenticated,
	username,
}: {
	installed: boolean;
	authenticated: boolean;
	username: string | null;
}) {
	if (authenticated && username) {
		return (
			<StatusRow
				icon={<LuCheck className="w-4 h-4 text-emerald-400" />}
				label="GitHub CLI"
				description={`Connected as @${username}`}
				variant="success"
			/>
		);
	}

	if (installed) {
		return (
			<StatusRow
				icon={<LuTriangleAlert className="w-4 h-4 text-amber-400" />}
				label="GitHub CLI"
				description="Installed but not logged in"
				variant="warning"
			>
				<Hint>
					<LuTerminal className="w-3 h-3 shrink-0 mt-0.5" />
					<span>
						Run{" "}
						<code className="px-1 py-0.5 rounded bg-muted text-foreground text-xs">
							gh auth login
						</code>{" "}
						in your terminal to connect your GitHub account.
					</span>
				</Hint>
			</StatusRow>
		);
	}

	return (
		<StatusRow
			icon={<LuTriangleAlert className="w-4 h-4 text-amber-400" />}
			label="GitHub CLI"
			description="Not installed"
			variant="warning"
		>
			<Hint>
				<span>
					Install from{" "}
					<button
						type="button"
						className="underline underline-offset-2 hover:text-foreground transition-colors"
						onClick={() => window.open("https://cli.github.com", "_blank")}
					>
						cli.github.com
					</button>{" "}
					to enable PR features.
				</span>
			</Hint>
		</StatusRow>
	);
}

function StatusRow({
	icon,
	label,
	description,
	variant,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	description: string;
	variant: "success" | "warning" | "error";
	children?: React.ReactNode;
}) {
	const borderColor = {
		success: "border-emerald-500/20",
		warning: "border-amber-500/20",
		error: "border-red-500/20",
	}[variant];

	return (
		<div className={`rounded-lg border ${borderColor} bg-muted/30 px-4 py-3`}>
			<div className="flex items-center gap-3">
				{icon}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-foreground">{label}</span>
						<span className="text-xs text-muted-foreground">{description}</span>
					</div>
				</div>
			</div>
			{children}
		</div>
	);
}

function Hint({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-2 mt-2 ml-7 text-xs text-muted-foreground">{children}</div>
	);
}
