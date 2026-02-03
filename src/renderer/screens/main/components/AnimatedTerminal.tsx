import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

export interface TerminalLine {
	type: "command" | "output" | "success" | "error" | "diff-add" | "diff-remove";
	text: string;
}

interface AnimatedTerminalProps {
	title: string;
	script: TerminalLine[];
	delay?: number;
}

const getLineColor = (type: TerminalLine["type"]) => {
	switch (type) {
		case "command":
			return "text-foreground";
		case "output":
			return "text-muted-foreground";
		case "success":
			return "text-green-400";
		case "error":
			return "text-red-400";
		case "diff-add":
			return "text-green-400";
		case "diff-remove":
			return "text-red-400";
		default:
			return "text-foreground";
	}
};

export function AnimatedTerminal({ title, script, delay = 0 }: AnimatedTerminalProps) {
	const [visibleLines, setVisibleLines] = useState(0);
	const [currentText, setCurrentText] = useState("");
	const [isStarted, setIsStarted] = useState(false);
	const [showCursor, setShowCursor] = useState(true);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cursor blink
	useEffect(() => {
		const interval = setInterval(() => setShowCursor(prev => !prev), 530);
		return () => clearInterval(interval);
	}, []);

	// Start delay
	useEffect(() => {
		const timer = setTimeout(() => setIsStarted(true), delay);
		return () => clearTimeout(timer);
	}, [delay]);

	// Typing animation
	useEffect(() => {
		if (!isStarted) return;

		// Reset and loop
		if (visibleLines >= script.length) {
			timeoutRef.current = setTimeout(() => {
				setVisibleLines(0);
				setCurrentText("");
			}, 3000); // Longer pause before loop
			return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
		}

		const line = script[visibleLines];
		const isCommand = line.type === "command";
		const typeSpeed = isCommand ? 100 : 60; // Even slower typing

		if (currentText.length < line.text.length) {
			timeoutRef.current = setTimeout(() => {
				setCurrentText(line.text.slice(0, currentText.length + 1));
			}, typeSpeed);
		} else {
			// Longer pause between lines
			timeoutRef.current = setTimeout(() => {
				setVisibleLines(prev => prev + 1);
				setCurrentText("");
			}, isCommand ? 800 : 400);
		}

		return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
	}, [isStarted, visibleLines, currentText, script]);

	const getPrefix = (type: TerminalLine["type"]) => {
		if (type === "command") return <span className="text-primary">$ </span>;
		if (type === "diff-add") return "+ ";
		if (type === "diff-remove") return "- ";
		return null;
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, delay: delay / 1000 }}
			className="w-52 h-44 rounded-lg border border-border/60 bg-[#0a0a0a] overflow-hidden flex flex-col"
		>
			{/* Title bar */}
			<div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-card/50">
				<div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
				<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
				<div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
				<span className="ml-2 text-xs text-muted-foreground">{title}</span>
			</div>

			{/* Terminal content */}
			<div className="flex-1 p-2 font-mono text-xs overflow-hidden">
				{/* Completed lines */}
				{script.slice(0, visibleLines).map((line, i) => (
					<div key={i} className={`${getLineColor(line.type)} whitespace-pre`}>
						{getPrefix(line.type)}{line.text}
					</div>
				))}

				{/* Current line being typed */}
				{visibleLines < script.length && (
					<div className={`${getLineColor(script[visibleLines].type)} whitespace-pre`}>
						{getPrefix(script[visibleLines].type)}
						{currentText}
						{showCursor && <span className="bg-foreground text-background ml-px">▊</span>}
					</div>
				)}
			</div>
		</motion.div>
	);
}

// Pre-defined scripts
export const TERMINAL_SCRIPTS = {
	fixBugs: [
		{ type: "command", text: "git status" },
		{ type: "output", text: "modified: src/api/auth.ts" },
		{ type: "command", text: "npm test" },
		{ type: "error", text: "✗ 1 test failed" },
		{ type: "command", text: "caspian fix auth.ts" },
		{ type: "output", text: "Fixed null reference error" },
		{ type: "command", text: "npm test" },
		{ type: "success", text: "✓ All tests passing" },
	] as TerminalLine[],

	addFeature: [
		{ type: "command", text: "caspian add login-page" },
		{ type: "output", text: "Creating components..." },
		{ type: "diff-add", text: "src/pages/Login.tsx" },
		{ type: "diff-add", text: "src/hooks/useAuth.ts" },
		{ type: "diff-add", text: "src/api/auth.ts" },
		{ type: "success", text: "✓ 3 files created" },
	] as TerminalLine[],

	writeTests: [
		{ type: "command", text: "caspian test auth" },
		{ type: "output", text: "Generating tests..." },
		{ type: "command", text: "npm test src/auth" },
		{ type: "success", text: "  ✓ validates token" },
		{ type: "success", text: "  ✓ handles expiry" },
		{ type: "success", text: "  ✓ refreshes session" },
		{ type: "success", text: "✓ 3 tests passed" },
	] as TerminalLine[],
};
