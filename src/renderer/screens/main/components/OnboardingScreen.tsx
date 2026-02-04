import { Button } from "ui/components/ui/button";
import { motion } from "framer-motion";
import { LuGitBranch, LuBot, LuZap } from "react-icons/lu";
import { AnimatedTerminal, TERMINAL_SCRIPTS } from "./AnimatedTerminal";
import caspianLogo from "renderer/assets/caspian-logo.jpeg";

interface OnboardingScreenProps {
	onContinue: () => void;
}

export function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
	return (
		<div className="flex-1 h-full flex flex-col items-center justify-center bg-background px-6">
			{/* Main content */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
				className="max-w-2xl w-full text-center"
			>
				{/* Logo and Welcome */}
				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
					className="mb-6"
				>
					<img
						src={caspianLogo}
						alt="Caspian"
						className="w-28 h-28 object-contain mx-auto rounded-2xl"
					/>
				</motion.div>
				<motion.h1
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="text-4xl font-semibold text-foreground tracking-tight mb-4"
				>
					Welcome to Caspian
				</motion.h1>

				{/* Problem */}
				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.2 }}
					className="text-lg text-muted-foreground mb-6"
				>
					AI coding assistants today work one task at a time.
					<br />
					<span className="text-muted-foreground/60">You're stuck waiting in line.</span>
				</motion.p>

				{/* Solution */}
				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
					className="text-lg text-foreground mb-12"
				>
					Caspian lets you run <span className="text-primary font-medium">multiple AI agents in parallel</span>
					<br />
					each in its own isolated workspace called a <span className="font-semibold">node</span>.
				</motion.p>

				{/* Visual: Three animated terminals */}
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.6, delay: 0.4 }}
					className="flex items-center justify-center gap-4 mb-8"
				>
					{[
						{ label: "Fix bugs", script: TERMINAL_SCRIPTS.fixBugs, delay: 1000 },
						{ label: "Add feature", script: TERMINAL_SCRIPTS.addFeature, delay: 3000 },
						{ label: "Write tests", script: TERMINAL_SCRIPTS.writeTests, delay: 5000 },
					].map((node) => (
						<div key={node.label} className="flex flex-col items-center">
							<AnimatedTerminal
								title={node.label}
								script={node.script}
								delay={node.delay}
							/>
							<div className="w-px h-4 bg-border/40 mt-2" />
						</div>
					))}
				</motion.div>

				{/* Codebase line */}
				<motion.div
					initial={{ opacity: 0, scaleX: 0 }}
					animate={{ opacity: 1, scaleX: 1 }}
					transition={{ duration: 0.6, delay: 0.8 }}
					className="flex items-center justify-center gap-3 mb-12"
				>
					<div className="h-px flex-1 max-w-[100px] bg-gradient-to-r from-transparent to-border/60" />
					<div className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/40 bg-muted/30">
						<LuGitBranch className="w-4 h-4 text-muted-foreground" />
						<span className="text-sm text-muted-foreground">your codebase</span>
					</div>
					<div className="h-px flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-border/60" />
				</motion.div>

				{/* Tagline */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.5, delay: 0.9 }}
					className="flex items-center justify-center gap-6 mb-12 text-muted-foreground"
				>
					<span className="flex items-center gap-2">
						<LuBot className="w-4 h-4" />
						More agents
					</span>
					<span className="text-muted-foreground/30">·</span>
					<span className="flex items-center gap-2">
						<LuZap className="w-4 h-4" />
						More speed
					</span>
					<span className="text-muted-foreground/30">·</span>
					<span>Zero conflicts</span>
				</motion.div>

				{/* CTA */}
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 1 }}
				>
					<Button
						size="lg"
						onClick={onContinue}
						className="px-8 py-6 text-base"
					>
						Get Started
					</Button>
				</motion.div>
			</motion.div>
		</div>
	);
}
