import type { CheckItem } from "lib/local-db/schema/zod";
import { useState } from "react";
import {
	LuCheck,
	LuChevronDown,
	LuChevronRight,
	LuLoaderCircle,
	LuMinus,
	LuX,
} from "react-icons/lu";

const CHECK_STATUS_CONFIG = {
	success: { icon: LuCheck, className: "text-emerald-500" },
	failure: { icon: LuX, className: "text-red-400" },
	pending: { icon: LuLoaderCircle, className: "text-amber-500" },
	skipped: { icon: LuMinus, className: "text-muted-foreground" },
	cancelled: { icon: LuMinus, className: "text-muted-foreground" },
} as const;

interface ChecksListProps {
	checks: CheckItem[];
}

export function ChecksList({ checks }: ChecksListProps) {
	const [expanded, setExpanded] = useState(false);

	const relevantChecks = checks.filter((c) => c.status !== "skipped" && c.status !== "cancelled");

	if (relevantChecks.length === 0) return null;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
			>
				{expanded ? <LuChevronDown className="size-3" /> : <LuChevronRight className="size-3" />}
				<span>{expanded ? "Hide checks" : "Show checks"}</span>
			</button>

			{expanded && (
				<div className="mt-1.5 space-y-1 pl-1">
					{relevantChecks.map((check) => (
						<CheckItemRow key={check.name} check={check} />
					))}
				</div>
			)}
		</div>
	);
}

function CheckItemRow({ check }: { check: CheckItem }) {
	const config = CHECK_STATUS_CONFIG[check.status];
	const Icon = config.icon;

	const content = (
		<span className="flex items-center gap-1.5 py-0.5">
			<Icon
				className={`size-3 shrink-0 ${config.className} ${check.status === "pending" ? "animate-spin" : ""}`}
			/>
			<span className="truncate">{check.name}</span>
		</span>
	);

	if (check.url) {
		return (
			<a
				href={check.url}
				target="_blank"
				rel="noopener noreferrer"
				className="block text-muted-foreground hover:text-foreground transition-colors"
			>
				{content}
			</a>
		);
	}

	return <div className="text-muted-foreground">{content}</div>;
}
