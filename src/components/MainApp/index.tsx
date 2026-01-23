import { useEffect, useCallback, useState } from 'react';
import { TitleBar } from '../TitleBar';
import { Sidebar } from '../Sidebar';
import { WorkspaceHeader } from '../WorkspaceHeader';
import { TabBar } from '../TabBar';
import { MainPanel } from '../MainPanel';
import { InspectorPane } from '../RightPanel';
import { BottomSheet } from '../BottomSheet';
import { CreatePRModal } from '../Modals';
import { CloneDialog } from '../HomeScreen/CloneDialog';
import { QuickStartDialog } from '../HomeScreen/QuickStartDialog';
import { InitGitPromptDialog } from '../HomeScreen/InitGitPromptDialog';
import { MissingRepositoryDialog } from '../HomeScreen/MissingRepositoryDialog';
import { AgentDiagnosticsModal } from '../Diagnostics/AgentDiagnosticsModal';
import { ResizeHandle } from '../common/ResizeHandle';
import { ToastContainer } from '../Toast/ToastContainer';
import { useRepositoryStore } from '../../stores/repositoryStore';
import { useNodeStore } from '../../stores/nodeStore';
import { useUIStore } from '../../stores/uiStore';
import { useWindowFocusStore } from '../../stores/windowFocusStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useStateChangeNotifications } from '../../hooks/useStateChangeNotifications';
import { useViewRouter } from '../../hooks/useViewRouter';

export function MainApp() {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  // Use individual selectors to avoid re-renders from unrelated store changes
  const fetchRepositories = useRepositoryStore(state => state.fetchRepositories);
  const focusMode = useUIStore(state => state.focusMode);
  const sidebarWidth = useUIStore(state => state.sidebarWidth);
  const setSidebarWidth = useUIStore(state => state.setSidebarWidth);
  const setRightPanelWidth = useUIStore(state => state.setRightPanelWidth);
  const errorMessage = useUIStore(state => state.errorMessage);
  const clearError = useUIStore(state => state.clearError);
  const bottomSheetOpen = useUIStore(state => state.bottomSheetOpen);
  const setBottomSheetOpen = useUIStore(state => state.setBottomSheetOpen);
  const bottomSheetContent = useUIStore(state => state.bottomSheetContent);

  // Use centralized view router for view state
  const { showWorkspaceChrome, toggleControlRoom } = useViewRouter();

  // Use centralized keyboard shortcuts
  useKeyboardShortcuts();

  // Subscribe to state change notifications
  useStateChangeNotifications();

  // Subscribe to window focus events on mount
  useEffect(() => {
    const unsubscribe = useWindowFocusStore.getState().subscribeToWindowEvents();
    return unsubscribe;
  }, []);

  // Resize handlers - use functional updates to avoid stale closure
  const handleSidebarResize = useCallback((delta: number) => {
    setSidebarWidth(prev => Math.max(200, Math.min(500, prev + delta)));
  }, [setSidebarWidth]);

  const handleRightPanelResize = useCallback((delta: number) => {
    // Negative delta = dragging left = increase width
    setRightPanelWidth(prev => Math.max(250, Math.min(600, prev - delta)));
  }, [setRightPanelWidth]);

  // Fetch repositories on app load - always start with HomeScreen (no auto-restore)
  useEffect(() => {
    const initializeApp = async () => {
      await fetchRepositories();
      // Don't auto-select any repo - show HomeScreen and let user choose
    };

    initializeApp();
  }, [fetchRepositories]);

  // Auto-dismiss error toast after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, clearError]);

  // Additional keyboard shortcuts specific to MainApp
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd+N: New node (create directly, no dialog)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        const { activeRepoId } = useRepositoryStore.getState();
        if (activeRepoId) {
          const { createNode, setActiveNode } = useNodeStore.getState();
          const newNode = await createNode(activeRepoId, 'New node');
          if (newNode) {
            setActiveNode(newNode.id);
          } else {
            const { error: nodeError } = useNodeStore.getState();
            if (nodeError) {
              useUIStore.getState().setErrorMessage(nodeError);
            }
          }
        }
      }
      // Cmd+F: Toggle focus mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !e.shiftKey) {
        e.preventDefault();
        useUIStore.getState().toggleFocusMode();
      }
      // Cmd+0: Toggle control room
      if ((e.metaKey || e.ctrlKey) && e.key === '0' && !e.shiftKey) {
        e.preventDefault();
        toggleControlRoom();
      }
      // Cmd+Shift+D: Open agent diagnostics
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowDiagnostics(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleControlRoom]);

  return (
    <div className="h-screen flex flex-col text-text-body overflow-hidden relative" style={{ padding: '0 var(--layout-app-padding) var(--layout-app-padding)' }}>
      {/* App background gradient with top-left light source */}
      <div className="app-background" />
      {/* Vignette overlay for depth */}
      <div className="app-vignette" />
      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* macOS title bar region for traffic lights and window drag */}
      <TitleBar />

      {/* Toast notifications for state changes */}
      <ToastContainer />

      {/* Error toast - z-[100] to appear above modals (z-50) */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-[100] bg-error/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md mt-14">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm flex-1">{errorMessage}</span>
          <button onClick={clearError} className="hover:text-white/70 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content: Sidebar + Workspace */}
      <div className="flex-1 flex overflow-hidden" style={{ gap: 'var(--layout-gap)' }}>
        <Sidebar width={focusMode ? 60 : sidebarWidth} />

        {/* Sidebar resize handle */}
        {!focusMode && (
          <ResizeHandle
            direction="horizontal"
            onResize={handleSidebarResize}
          />
        )}

        {/* Workspace - unified card with header, tabs, and content */}
        <div className="flex-1 flex flex-col overflow-hidden glass-center">
          {/* Workspace header (repo/branch + actions) - only shown in workspace mode */}
          {showWorkspaceChrome && <WorkspaceHeader />}

          {/* Tab bar (Chat + file/diff tabs) - only shown in workspace mode */}
          {showWorkspaceChrome && <TabBar />}

          {/* Content area: Main view + Inspector rail */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main view (active tab content) */}
            <MainPanel />

            {/* Inspector resize handle - only shown in workspace mode */}
            {showWorkspaceChrome && (
              <ResizeHandle
                direction="horizontal"
                onResize={handleRightPanelResize}
              />
            )}

            {/* Inspector rail - only shown in workspace mode */}
            {showWorkspaceChrome && <InspectorPane />}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CloneDialog />
      <QuickStartDialog />
      <InitGitPromptDialog />
      <MissingRepositoryDialog />

      {/* Modals */}
      <CreatePRModal />

      {/* Agent Diagnostics Modal (Cmd+Shift+D) */}
      <AgentDiagnosticsModal isOpen={showDiagnostics} onClose={() => setShowDiagnostics(false)} />

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        title="Action Required"
        canDismiss={false}
      >
        {bottomSheetContent}
      </BottomSheet>
    </div>
  );
}
