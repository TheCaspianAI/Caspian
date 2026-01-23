import { create } from 'zustand';
import type { GridViewState } from '../types';

// Valid grid sizes from 2x2 to 10x10
export type GridSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Calculate optimal grid size based on item count
export function getOptimalGridSize(itemCount: number): GridSize {
  // Find smallest grid that fits all items
  // Grid sizes: 2(4), 3(9), 4(16), 5(25), 6(36), 7(49), 8(64), 9(81), 10(100)
  if (itemCount <= 4) return 2;
  if (itemCount <= 9) return 3;
  if (itemCount <= 16) return 4;
  if (itemCount <= 25) return 5;
  if (itemCount <= 36) return 6;
  if (itemCount <= 49) return 7;
  if (itemCount <= 64) return 8;
  if (itemCount <= 81) return 9;
  return 10;
}

interface GridStoreState extends GridViewState {
  // Actions
  setGridSize: (size: GridSize) => void;
  setAutoGridSize: (itemCount: number) => void;
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // Selection
  setSelectedIndex: (index: number | null) => void;
  toggleMultiSelect: (index: number) => void;
  addToSelection: (index: number) => void;
  removeFromSelection: (index: number) => void;
  selectRange: (startIndex: number, endIndex: number) => void;
  clearSelection: () => void;

  // Navigation
  moveSelection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  jumpToIndex: (index: number) => void;

  // Search
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;

  // Zoom (Project View)
  zoomIn: (folderName: string) => void;
  zoomOut: () => void;
  zoomToPath: (path: string[]) => void;

  // Number input modal
  setShowNumberInput: (show: boolean) => void;

  // Reset
  reset: () => void;
}

const getStoredGridSize = (): GridSize | null => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('gridSize');
    if (stored) {
      const size = parseInt(stored, 10);
      if (size >= 2 && size <= 10) return size as GridSize;
    }
  }
  return null; // null means auto
};

const initialState: GridViewState = {
  gridSize: getStoredGridSize() || 4, // Default to 4, will be auto-set
  currentPage: 0,
  selectedIndex: 0,
  selectedIndices: [],
  searchQuery: '',
  zoomPath: [],
  showNumberInput: false,
};

export const useGridStore = create<GridStoreState>((set, get) => ({
  ...initialState,

  // Grid size
  setGridSize: (size: GridSize) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gridSize', String(size));
    }
    set({ gridSize: size, currentPage: 0, selectedIndex: 0 });
  },

  setAutoGridSize: (itemCount: number) => {
    const optimalSize = getOptimalGridSize(itemCount);
    // Only auto-set if no stored preference
    const storedSize = getStoredGridSize();
    if (storedSize === null) {
      set({ gridSize: optimalSize, currentPage: 0, selectedIndex: 0 });
    }
  },

  // Pagination
  setCurrentPage: (page: number) => set({ currentPage: page, selectedIndex: 0 }),
  nextPage: () => set((state) => ({ currentPage: state.currentPage + 1, selectedIndex: 0 })),
  prevPage: () => set((state) => ({
    currentPage: Math.max(0, state.currentPage - 1),
    selectedIndex: 0
  })),

  // Selection
  setSelectedIndex: (index: number | null) => set({ selectedIndex: index }),

  toggleMultiSelect: (index: number) => set((state) => {
    const indices = state.selectedIndices;
    if (indices.includes(index)) {
      return { selectedIndices: indices.filter(i => i !== index) };
    }
    return { selectedIndices: [...indices, index] };
  }),

  addToSelection: (index: number) => set((state) => {
    if (!state.selectedIndices.includes(index)) {
      return { selectedIndices: [...state.selectedIndices, index] };
    }
    return state;
  }),

  removeFromSelection: (index: number) => set((state) => ({
    selectedIndices: state.selectedIndices.filter(i => i !== index)
  })),

  selectRange: (startIndex: number, endIndex: number) => set(() => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return { selectedIndices: range };
  }),

  clearSelection: () => set({ selectedIndices: [], selectedIndex: null }),

  // Navigation
  moveSelection: (direction: 'up' | 'down' | 'left' | 'right') => {
    const { selectedIndex, gridSize } = get();
    if (selectedIndex === null) {
      set({ selectedIndex: 0 });
      return;
    }

    const cols = gridSize;
    const maxIndex = gridSize * gridSize - 1;
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

    set({ selectedIndex: newIndex });
  },

  jumpToIndex: (index: number) => {
    const { gridSize } = get();
    const pageSize = gridSize * gridSize;
    const page = Math.floor(index / pageSize);
    const indexInPage = index % pageSize;
    set({ currentPage: page, selectedIndex: indexInPage });
  },

  // Search
  setSearchQuery: (query: string) => set({ searchQuery: query, currentPage: 0 }),
  clearSearch: () => set({ searchQuery: '' }),

  // Zoom (Project View)
  zoomIn: (folderName: string) => set((state) => ({
    zoomPath: [...state.zoomPath, folderName],
    currentPage: 0,
    selectedIndex: 0,
  })),

  zoomOut: () => set((state) => ({
    zoomPath: state.zoomPath.slice(0, -1),
    currentPage: 0,
    selectedIndex: 0,
  })),

  zoomToPath: (path: string[]) => set({
    zoomPath: path,
    currentPage: 0,
    selectedIndex: 0,
  }),

  // Number input modal
  setShowNumberInput: (show: boolean) => set({ showNumberInput: show }),

  // Reset
  reset: () => set(initialState),
}));
