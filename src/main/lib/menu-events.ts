import { EventEmitter } from "node:events";

export type SettingsSection =
	| "repository"
	| "node"
	| "appearance"
	| "keyboard"
	| "terminal"
	| "integrations";

export interface OpenSettingsEvent {
	section?: SettingsSection;
}

export interface OpenNodeEvent {
	nodeId: string;
}

export const menuEmitter = new EventEmitter();
