import { useEffect, useCallback } from 'react';
import { useGridStore } from '../stores/gridStore';

interface UseGridNavigationProps {
  totalItems: number;
  rows: number;
  cols: number;
  onOpen: (index: number) => void;
  onClose: () => void;
  onDelete: (indices: number[]) => void;
  enabled?: boolean;
}

export function useGridNavigation({
  totalItems,
  rows,
  cols,
  onOpen,
  onClose,
  onDelete,
  enabled = true,
}: UseGridNavigationProps) {
  const {
    selectedIndex,
    selectedIndices,
    currentPage,
    setSelectedIndex,
    toggleMultiSelect,
    selectRange,
    clearSelection,
    nextPage,
    prevPage,
  } = useGridStore();

  const pageSize = rows * cols;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Move selection in a direction
  const moveSelection = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (selectedIndex === null) {
      setSelectedIndex(0);
      return;
    }

    const maxIndex = totalItems - 1;
    let newIndex = selectedIndex;

    switch (direction) {
      case 'up':
        newIndex = selectedIndex - cols;
        if (newIndex < 0) newIndex = selectedIndex; // Stay at current
        break;
      case 'down':
        newIndex = selectedIndex + cols;
        if (newIndex > maxIndex) newIndex = selectedIndex; // Stay at current
        break;
      case 'left':
        if (selectedIndex % cols !== 0) {
          newIndex = selectedIndex - 1;
        }
        break;
      case 'right':
        if ((selectedIndex + 1) % cols !== 0 && selectedIndex < maxIndex) {
          newIndex = selectedIndex + 1;
        }
        break;
    }

    if (newIndex >= 0 && newIndex <= maxIndex) {
      setSelectedIndex(newIndex);
    }
  }, [selectedIndex, cols, totalItems, setSelectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    switch (e.key) {
      // Arrow keys navigation
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        moveSelection('up');
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        moveSelection('down');
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        moveSelection('left');
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        moveSelection('right');
        break;

      // Open selected card
      case 'Enter':
        e.preventDefault();
        if (selectedIndex !== null) {
          onOpen(selectedIndex);
        }
        break;

      // Toggle multi-select with Space
      case ' ':
        e.preventDefault();
        if (selectedIndex !== null) {
          toggleMultiSelect(selectedIndex);
        }
        break;

      // Clear selection / close
      case 'Escape':
        e.preventDefault();
        if (selectedIndices.length > 0) {
          clearSelection();
        } else {
          onClose();
        }
        break;

      // Delete selected nodes
      case 'Delete':
      case 'Backspace':
        if (selectedIndices.length > 0) {
          e.preventDefault();
          onDelete(selectedIndices);
        } else if (selectedIndex !== null) {
          e.preventDefault();
          onDelete([selectedIndex]);
        }
        break;

      // Page navigation
      case 'PageUp':
        e.preventDefault();
        if (currentPage > 0) {
          prevPage();
        }
        break;

      case 'PageDown':
        e.preventDefault();
        if (currentPage < totalPages - 1) {
          nextPage();
        }
        break;

      default:
        break;
    }
  }, [
    enabled,
    selectedIndex,
    selectedIndices,
    currentPage,
    totalPages,
    moveSelection,
    toggleMultiSelect,
    clearSelection,
    nextPage,
    prevPage,
    onOpen,
    onClose,
    onDelete,
  ]);

  // Handle shift+click for range selection
  const handleRangeSelect = useCallback((index: number, shiftKey: boolean) => {
    if (shiftKey && selectedIndex !== null) {
      selectRange(selectedIndex, index);
    } else {
      setSelectedIndex(index);
    }
  }, [selectedIndex, selectRange, setSelectedIndex]);

  // Handle cmd/ctrl+click for toggle selection
  const handleToggleSelect = useCallback((index: number) => {
    toggleMultiSelect(index);
  }, [toggleMultiSelect]);

  // Set up keyboard listener
  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  // Initialize selection if none
  useEffect(() => {
    if (enabled && selectedIndex === null && totalItems > 0) {
      setSelectedIndex(0);
    }
  }, [enabled, selectedIndex, totalItems, setSelectedIndex]);

  return {
    handleRangeSelect,
    handleToggleSelect,
    selectedIndex,
    selectedIndices,
    currentPage,
    pageSize,
    totalPages,
  };
}
