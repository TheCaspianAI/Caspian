import { observable } from "@trpc/server/observable";
import {
	menuEmitter,
	type OpenSettingsEvent,
	type OpenNodeEvent,
	type SettingsSection,
} from "main/lib/menu-events";
import { publicProcedure, router } from "..";

type MenuEvent =
	| { type: "open-settings"; data: OpenSettingsEvent }
	| { type: "open-node"; data: OpenNodeEvent };

export const createMenuRouter = () => {
	return router({
		subscribe: publicProcedure.subscription(() => {
			return observable<MenuEvent>((emit) => {
				const onOpenSettings = (section?: SettingsSection) => {
					emit.next({ type: "open-settings", data: { section } });
				};

				const onOpenNode = (nodeId: string) => {
					emit.next({ type: "open-node", data: { nodeId } });
				};

				menuEmitter.on("open-settings", onOpenSettings);
				menuEmitter.on("open-node", onOpenNode);

				return () => {
					menuEmitter.off("open-settings", onOpenSettings);
					menuEmitter.off("open-node", onOpenNode);
				};
			});
		}),
	});
};
