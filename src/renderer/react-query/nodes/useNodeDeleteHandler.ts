import { useState } from "react";

interface UseNodeDeleteHandlerResult {
	/** Whether the delete dialog should be shown */
	showDeleteDialog: boolean;
	/** Set whether the delete dialog should be shown */
	setShowDeleteDialog: (show: boolean) => void;
	/** Handle delete click - always shows the dialog to let user choose close or delete */
	handleDeleteClick: (e?: React.MouseEvent) => void;
}

/**
 * Shared hook for node delete/close dialog state.
 * Always shows the confirmation dialog to let user choose between closing or deleting.
 */
export function useNodeDeleteHandler(): UseNodeDeleteHandlerResult {
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const handleDeleteClick = (e?: React.MouseEvent) => {
		e?.stopPropagation();
		setShowDeleteDialog(true);
	};

	return {
		showDeleteDialog,
		setShowDeleteDialog,
		handleDeleteClick,
	};
}
