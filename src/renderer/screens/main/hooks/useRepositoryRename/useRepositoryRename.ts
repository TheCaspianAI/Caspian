import { useEffect, useState } from "react";
import { useUpdateRepository } from "renderer/react-query/repositories/useUpdateRepository";

export function useRepositoryRename(repositoryId: string, repositoryName: string) {
	const [isRenaming, setIsRenaming] = useState(false);
	const [renameValue, setRenameValue] = useState(repositoryName);
	const updateRepository = useUpdateRepository();

	useEffect(() => {
		setRenameValue(repositoryName);
	}, [repositoryName]);

	const startRename = () => {
		setIsRenaming(true);
	};

	const submitRename = () => {
		const trimmedValue = renameValue.trim();
		if (trimmedValue && trimmedValue !== repositoryName) {
			updateRepository.mutate({
				id: repositoryId,
				patch: { name: trimmedValue },
			});
		} else {
			setRenameValue(repositoryName);
		}
		setIsRenaming(false);
	};

	const cancelRename = () => {
		setRenameValue(repositoryName);
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
		setRenameValue,
		startRename,
		submitRename,
		cancelRename,
		handleKeyDown,
	};
}
