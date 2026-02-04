import type { ITheme } from "@xterm/xterm";
import debounce from "lodash/debounce";
import type { MutableRefObject } from "react";
import { useRef } from "react";
import { useTerminalCallbacksStore } from "renderer/stores/tabs/terminal-callbacks";

type DebouncedPaneNameSetter = ((paneId: string, name: string) => void) & {
	cancel?: () => void;
};

type RegisterCallback = (paneId: string, callback: () => void) => void;
type UnregisterCallback = (paneId: string) => void;

export interface UseTerminalRefsOptions {
	paneId: string;
	tabId: string;
	focusedPaneId: string | undefined;
	terminalTheme: ITheme | null;
	paneInitialCommands?: string[];
	paneInitialCwd?: string;
	clearPaneInitialData: (paneId: string) => void;
	nodeCwd: string | null | undefined;
	handleFileLinkClick: (path: string, line?: number, column?: number) => void;
	setPaneName: (paneId: string, name: string) => void;
	setPaneLastCompleted: (paneId: string) => void;
	setFocusedPane: (tabId: string, paneId: string) => void;
}

export interface UseTerminalRefsReturn {
	isFocused: boolean;
	isFocusedRef: MutableRefObject<boolean>;
	initialThemeRef: MutableRefObject<ITheme | null>;
	paneInitialCommandsRef: MutableRefObject<string[] | undefined>;
	paneInitialCwdRef: MutableRefObject<string | undefined>;
	clearPaneInitialDataRef: MutableRefObject<(paneId: string) => void>;
	nodeCwdRef: MutableRefObject<string | null>;
	handleFileLinkClickRef: MutableRefObject<(path: string, line?: number, column?: number) => void>;
	debouncedSetPaneNameRef: MutableRefObject<DebouncedPaneNameSetter>;
	setPaneLastCompletedRef: MutableRefObject<(paneId: string) => void>;
	handleTerminalFocusRef: MutableRefObject<() => void>;
	registerClearCallbackRef: MutableRefObject<RegisterCallback>;
	unregisterClearCallbackRef: MutableRefObject<UnregisterCallback>;
	registerScrollToBottomCallbackRef: MutableRefObject<RegisterCallback>;
	unregisterScrollToBottomCallbackRef: MutableRefObject<UnregisterCallback>;
}

export function useTerminalRefs({
	paneId,
	tabId,
	focusedPaneId,
	terminalTheme,
	paneInitialCommands,
	paneInitialCwd,
	clearPaneInitialData,
	nodeCwd,
	handleFileLinkClick,
	setPaneName,
	setPaneLastCompleted,
	setFocusedPane,
}: UseTerminalRefsOptions): UseTerminalRefsReturn {
	const initialThemeRef = useRef(terminalTheme);
	const isFocused = focusedPaneId === paneId;
	const isFocusedRef = useRef(isFocused);
	isFocusedRef.current = isFocused;

	const paneInitialCommandsRef = useRef(paneInitialCommands);
	const paneInitialCwdRef = useRef(paneInitialCwd);
	const clearPaneInitialDataRef = useRef(clearPaneInitialData);
	paneInitialCommandsRef.current = paneInitialCommands;
	paneInitialCwdRef.current = paneInitialCwd;
	clearPaneInitialDataRef.current = clearPaneInitialData;

	const nodeCwdRef = useRef<string | null>(nodeCwd ?? null);
	nodeCwdRef.current = nodeCwd ?? null;

	const handleFileLinkClickRef = useRef(handleFileLinkClick);
	handleFileLinkClickRef.current = handleFileLinkClick;

	const setPaneNameRef = useRef(setPaneName);
	setPaneNameRef.current = setPaneName;

	const setPaneLastCompletedRef = useRef(setPaneLastCompleted);
	setPaneLastCompletedRef.current = setPaneLastCompleted;

	const debouncedSetPaneNameRef = useRef(
		debounce((targetPaneId: string, name: string) => {
			setPaneNameRef.current(targetPaneId, name);
		}, 100),
	);

	const handleTerminalFocusRef = useRef(() => {});
	handleTerminalFocusRef.current = () => {
		setFocusedPane(tabId, paneId);
	};

	const registerClearCallbackRef = useRef(
		useTerminalCallbacksStore.getState().registerClearCallback,
	);
	const unregisterClearCallbackRef = useRef(
		useTerminalCallbacksStore.getState().unregisterClearCallback,
	);
	const registerScrollToBottomCallbackRef = useRef(
		useTerminalCallbacksStore.getState().registerScrollToBottomCallback,
	);
	const unregisterScrollToBottomCallbackRef = useRef(
		useTerminalCallbacksStore.getState().unregisterScrollToBottomCallback,
	);

	return {
		isFocused,
		isFocusedRef,
		initialThemeRef,
		paneInitialCommandsRef,
		paneInitialCwdRef,
		clearPaneInitialDataRef,
		nodeCwdRef,
		handleFileLinkClickRef,
		debouncedSetPaneNameRef,
		setPaneLastCompletedRef,
		handleTerminalFocusRef,
		registerClearCallbackRef,
		unregisterClearCallbackRef,
		registerScrollToBottomCallbackRef,
		unregisterScrollToBottomCallbackRef,
	};
}
