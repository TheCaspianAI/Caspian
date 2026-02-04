import { useEffect, useRef, useState } from "react";
import { useUpdateNode } from "renderer/react-query/nodes/useUpdateNode";

export function useNodeRename(nodeId: string, nodeName: string) {
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(nodeName);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const updateNode = useUpdateNode();

	// Select input text when rename mode is activated
	useEffect(() => {
		if (isRenaming && inputRef.current) {
			inputRef.current.select();
		}
	}, [isRenaming]);

	// Sync rename value when node name changes
	useEffect(() => {
		setRenameValue(nodeName);
	}, [nodeName]);

	const startRename = () => {
		setIsRenaming(true);
	};

	const submitRename = () => {
		const trimmedValue = renameValue.trim();
		if (trimmedValue && trimmedValue !== nodeName) {
			updateNode.mutate({
				id: nodeId,
				patch: { name: trimmedValue },
			});
		} else {
			setRenameValue(nodeName);
		}
		setIsRenaming(false);
	};

	const cancelRename = () => {
		setRenameValue(nodeName);
		setIsRenaming(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			submitRename();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancelRename();
		}
	};

	return {
		isRenaming,
		renameValue,
		inputRef,
		setRenameValue,
		startRename,
		submitRename,
		cancelRename,
		handleKeyDown,
	};
}
