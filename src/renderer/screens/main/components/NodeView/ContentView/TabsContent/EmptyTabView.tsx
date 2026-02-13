import { motion } from "framer-motion";
import { HiMiniCommandLine } from "react-icons/hi2";
import { useHotkeyDisplay } from "renderer/stores/hotkeys";
import { Kbd, KbdGroup } from "ui/components/ui/kbd";

export function EmptyTabView() {
	const newGroupDisplay = useHotkeyDisplay("NEW_GROUP");

	return (
		<div className="flex-1 flex flex-col items-center justify-center h-full">
			<motion.div
				className="flex flex-col items-center gap-5"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
			>
				<div className="p-6 rounded-2xl bg-accent/30 border border-border/20">
					<HiMiniCommandLine className="size-12 text-muted-foreground/40" />
				</div>

				<p className="flex items-center gap-2 text-body text-muted-foreground/50">
					<KbdGroup>
						{newGroupDisplay.map((key) => (
							<Kbd key={key}>{key}</Kbd>
						))}
					</KbdGroup>
					<span>to open a terminal</span>
				</p>
			</motion.div>
		</div>
	);
}
