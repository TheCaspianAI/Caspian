import { create } from 'zustand';
import type { Attachment, OpenFile, OpenDiff } from '../types';

export type AgentMode = 'normal' | 'plan' | 'auto_approve';

// View mode for main content area
export type ViewMode = 'home' | 'controlRoom' | 'workspace';

interface UIState {
  // Focus mode
  focusMode: boolean;
  toggleFocusMode: () => void;

  // Sidebar
  sidebarWidth: number;
  setSidebarWidth: (width: number | ((prev: number) => number)) => void;

  // Right panel
  rightPanelWidth: number;
  setRightPanelWidth: (width: number | ((prev: number) => number)) => void;

  // Active tab per node - 'chat' or a file ID (keyed by nodeId)
  activeTabIdByNode: Record<string, string>;
  setActiveTabId: (nodeId: string, tabId: string) => void;
  getActiveTabId: (nodeId: string | null) => string;

  // Home screen dialogs
  cloneDialogOpen: boolean;
  setCloneDialogOpen: (open: boolean) => void;

  quickStartDialogOpen: boolean;
  setQuickStartDialogOpen: (open: boolean) => void;

  initPromptDialogOpen: boolean;
  pendingInitPath: string | null;
  setInitPromptDialogOpen: (open: boolean, path?: string) => void;

  // Missing repository dialog
  missingRepoDialogOpen: boolean;
  missingRepoId: string | null;
  setMissingRepoDialog: (open: boolean, repoId?: string | null) => void;

  // Error toast
  errorMessage: string | null;
  setErrorMessage: (message: string | null) => void;
  clearError: () => void;

  // Model selection
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Agent mode (normal, plan, auto)
  agentMode: AgentMode;
  cycleAgentMode: () => void;
  setAgentMode: (mode: AgentMode) => void;

  // Modals
  diffModalOpen: boolean;
  setDiffModalOpen: (open: boolean) => void;

  historyModalOpen: boolean;
  setHistoryModalOpen: (open: boolean) => void;

  createPRModalOpen: boolean;
  setCreatePRModalOpen: (open: boolean) => void;
  isCreatingPR: boolean;
  setIsCreatingPR: (creating: boolean) => void;

  // Bottom sheet
  bottomSheetOpen: boolean;
  setBottomSheetOpen: (open: boolean) => void;
  bottomSheetContent: React.ReactNode | null;
  setBottomSheetContent: (content: React.ReactNode | null) => void;

  // Attachments
  attachments: Attachment[];
  addAttachment: (file: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  // Review mode
  reviewMode: boolean;
  setReviewMode: (active: boolean) => void;

  // View mode - single source of truth for which screen is shown
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Grid view (deprecated - use viewMode instead, kept for backward compatibility)
  gridViewOpen: boolean;
  setGridViewOpen: (open: boolean) => void;

  // Open file tabs per node (keyed by nodeId)
  openFilesByNode: Record<string, OpenFile[]>;
  openFile: (nodeId: string, file: OpenFile) => void;
  closeFile: (nodeId: string, fileId: string) => void;
  updateFileContent: (nodeId: string, fileId: string, content: string) => void;
  getOpenFiles: (nodeId: string | null) => OpenFile[];

  // Open diff tabs per node (keyed by nodeId)
  openDiffsByNode: Record<string, OpenDiff[]>;
  openDiff: (nodeId: string, diff: OpenDiff) => void;
  closeDiff: (nodeId: string, diffId: string) => void;
  getOpenDiffs: (nodeId: string | null) => OpenDiff[];

  // Close any tab (file or diff)
  closeTab: (nodeId: string, tabId: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Focus mode
  focusMode: false,
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  // Sidebar
  sidebarWidth: typeof localStorage !== 'undefined'
    ? parseInt(localStorage.getItem('sidebarWidth') || '260', 10)
    : 260,
  setSidebarWidth: (width: number | ((prev: number) => number)) => {
    const newWidth = typeof width === 'function' ? width(get().sidebarWidth) : width;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebarWidth', String(newWidth));
    }
    set({ sidebarWidth: newWidth });
  },

  // Right panel
  rightPanelWidth: typeof localStorage !== 'undefined'
    ? parseInt(localStorage.getItem('rightPanelWidth') || '350', 10)
    : 350,
  setRightPanelWidth: (width: number | ((prev: number) => number)) => {
    const newWidth = typeof width === 'function' ? width(get().rightPanelWidth) : width;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rightPanelWidth', String(newWidth));
    }
    set({ rightPanelWidth: newWidth });
  },

  // Active tab per node - 'chat' or a file ID
  activeTabIdByNode: {},
  setActiveTabId: (nodeId: string, tabId: string) => set((state) => ({
    activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: tabId },
  })),
  getActiveTabId: (nodeId: string | null) => {
    if (!nodeId) return 'chat';
    return get().activeTabIdByNode[nodeId] || 'chat';
  },

  // Home screen dialogs
  cloneDialogOpen: false,
  setCloneDialogOpen: (open: boolean) => set({ cloneDialogOpen: open }),

  quickStartDialogOpen: false,
  setQuickStartDialogOpen: (open: boolean) => set({ quickStartDialogOpen: open }),

  initPromptDialogOpen: false,
  pendingInitPath: null,
  setInitPromptDialogOpen: (open: boolean, path?: string) => set({
    initPromptDialogOpen: open,
    pendingInitPath: path ?? null,
  }),

  // Missing repository dialog
  missingRepoDialogOpen: false,
  missingRepoId: null,
  setMissingRepoDialog: (open: boolean, repoId?: string | null) => set({
    missingRepoDialogOpen: open,
    missingRepoId: repoId ?? null,
  }),

  // Error toast
  errorMessage: null,
  setErrorMessage: (message: string | null) => set({ errorMessage: message }),
  clearError: () => set({ errorMessage: null }),

  // Model selection
  selectedModel: typeof localStorage !== 'undefined' ? localStorage.getItem('selectedModel') || 'opus-4.5' : 'opus-4.5',
  setSelectedModel: (model: string) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('selectedModel', model);
    }
    set({ selectedModel: model });
  },

  // Agent mode (normal or plan) - accept mode is always on by default
  agentMode: (() => {
    if (typeof localStorage === 'undefined') return 'normal' as AgentMode;
    const stored = localStorage.getItem('agentMode');
    // Migrate old 'auto' or 'accept' values to 'normal'
    if (stored === 'auto' || stored === 'accept') {
      localStorage.setItem('agentMode', 'normal');
      return 'normal' as AgentMode;
    }
    // Only allow 'normal' or 'plan'
    if (stored === 'plan') return 'plan' as AgentMode;
    return 'normal' as AgentMode;
  })(),
  cycleAgentMode: () => {
    const current = get().agentMode;
    const nextMode: AgentMode = current === 'normal' ? 'plan' : 'normal';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('agentMode', nextMode);
    }
    set({ agentMode: nextMode });
  },
  setAgentMode: (mode: AgentMode) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('agentMode', mode);
    }
    set({ agentMode: mode });
  },

  // Modals
  diffModalOpen: false,
  setDiffModalOpen: (open: boolean) => set({ diffModalOpen: open }),

  historyModalOpen: false,
  setHistoryModalOpen: (open: boolean) => set({ historyModalOpen: open }),

  createPRModalOpen: false,
  setCreatePRModalOpen: (open: boolean) => set({ createPRModalOpen: open }),
  isCreatingPR: false,
  setIsCreatingPR: (creating: boolean) => set({ isCreatingPR: creating }),

  // Bottom sheet
  bottomSheetOpen: false,
  setBottomSheetOpen: (open: boolean) => set({ bottomSheetOpen: open }),
  bottomSheetContent: null,
  setBottomSheetContent: (content: React.ReactNode | null) => set({ bottomSheetContent: content }),

  // Attachments
  attachments: [],
  addAttachment: (file: Attachment) => set((state) => ({
    attachments: [...state.attachments, file]
  })),
  removeAttachment: (id: string) => set((state) => ({
    attachments: state.attachments.filter((a) => a.id !== id)
  })),
  clearAttachments: () => set({ attachments: [] }),

  // Review mode
  reviewMode: false,
  setReviewMode: (active: boolean) => set({ reviewMode: active }),

  // View mode - single source of truth for which screen is shown
  viewMode: 'home' as ViewMode,
  setViewMode: (mode: ViewMode) => set({
    viewMode: mode,
    // Sync gridViewOpen for backward compatibility
    gridViewOpen: mode === 'controlRoom',
  }),

  // Grid view (deprecated - use viewMode instead, kept for backward compatibility)
  gridViewOpen: false,
  setGridViewOpen: (open: boolean) => set({
    gridViewOpen: open,
    // Sync viewMode when gridViewOpen changes
    viewMode: open ? 'controlRoom' : get().viewMode === 'controlRoom' ? 'home' : get().viewMode,
  }),

  // Open file tabs per node
  openFilesByNode: {},
  openFile: (nodeId: string, file: OpenFile) => set((state) => {
    const nodeFiles = state.openFilesByNode[nodeId] || [];
    // Check if file is already open in this node
    const existing = nodeFiles.find((f) => f.path === file.path);
    if (existing) {
      return {
        activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: existing.id },
      };
    }
    return {
      openFilesByNode: {
        ...state.openFilesByNode,
        [nodeId]: [...nodeFiles, file],
      },
      activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: file.id },
    };
  }),
  closeFile: (nodeId: string, fileId: string) => set((state) => {
    const nodeFiles = state.openFilesByNode[nodeId] || [];
    const newFiles = nodeFiles.filter((f) => f.id !== fileId);
    const currentActiveTab = state.activeTabIdByNode[nodeId] || 'chat';
    const nodeDiffs = state.openDiffsByNode[nodeId] || [];
    // If closing the active tab, switch to chat or previous file
    const newActiveId = currentActiveTab === fileId
      ? (newFiles.length > 0 ? newFiles[newFiles.length - 1].id
        : nodeDiffs.length > 0 ? nodeDiffs[nodeDiffs.length - 1].id
        : 'chat')
      : currentActiveTab;
    return {
      openFilesByNode: { ...state.openFilesByNode, [nodeId]: newFiles },
      activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: newActiveId },
    };
  }),
  updateFileContent: (nodeId: string, fileId: string, content: string) => set((state) => {
    const nodeFiles = state.openFilesByNode[nodeId] || [];
    return {
      openFilesByNode: {
        ...state.openFilesByNode,
        [nodeId]: nodeFiles.map((f) => f.id === fileId ? { ...f, content } : f),
      },
    };
  }),
  getOpenFiles: (nodeId: string | null) => {
    if (!nodeId) return [];
    return get().openFilesByNode[nodeId] || [];
  },

  // Open diff tabs per node
  openDiffsByNode: {},
  openDiff: (nodeId: string, diff: OpenDiff) => set((state) => {
    const nodeDiffs = state.openDiffsByNode[nodeId] || [];
    // Check if diff is already open in this node
    const existing = nodeDiffs.find((d) => d.path === diff.path);
    if (existing) {
      return {
        activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: existing.id },
      };
    }
    return {
      openDiffsByNode: {
        ...state.openDiffsByNode,
        [nodeId]: [...nodeDiffs, diff],
      },
      activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: diff.id },
    };
  }),
  closeDiff: (nodeId: string, diffId: string) => set((state) => {
    const nodeDiffs = state.openDiffsByNode[nodeId] || [];
    const newDiffs = nodeDiffs.filter((d) => d.id !== diffId);
    const currentActiveTab = state.activeTabIdByNode[nodeId] || 'chat';
    const nodeFiles = state.openFilesByNode[nodeId] || [];
    // If closing the active tab, switch to chat or previous tab
    const newActiveId = currentActiveTab === diffId
      ? (newDiffs.length > 0 ? newDiffs[newDiffs.length - 1].id
        : nodeFiles.length > 0 ? nodeFiles[nodeFiles.length - 1].id
        : 'chat')
      : currentActiveTab;
    return {
      openDiffsByNode: { ...state.openDiffsByNode, [nodeId]: newDiffs },
      activeTabIdByNode: { ...state.activeTabIdByNode, [nodeId]: newActiveId },
    };
  }),
  getOpenDiffs: (nodeId: string | null) => {
    if (!nodeId) return [];
    return get().openDiffsByNode[nodeId] || [];
  },

  // Close any tab (file or diff)
  closeTab: (nodeId: string, tabId: string) => {
    const state = get();
    const nodeFiles = state.openFilesByNode[nodeId] || [];
    const nodeDiffs = state.openDiffsByNode[nodeId] || [];
    const isFile = nodeFiles.some((f) => f.id === tabId);
    const isDiff = nodeDiffs.some((d) => d.id === tabId);

    if (isFile) {
      get().closeFile(nodeId, tabId);
    } else if (isDiff) {
      get().closeDiff(nodeId, tabId);
    }
  },
}));
