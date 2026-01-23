import { create } from 'zustand';
import { safeInvoke, safeInvokeWithError, safeListen, isTauri } from '../utils/tauri';

type UnlistenFn = () => void;

// Types matching the Rust backend
// Removed 'anonymous' - now we require gh CLI authentication
export type AppBootState = 'booting' | 'unauthenticated' | 'authenticated';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface AuthStatus {
  status: 'unauthenticated' | 'authenticated';
  user?: GitHubUser;
}

interface CommandResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface AuthState {
  // State
  bootState: AppBootState;
  user: GitHubUser | null;
  isLoading: boolean;
  error: string | null;
  setupProgress: string | null; // For showing setup progress messages
  hasCompletedOnboarding: boolean; // First-run onboarding flag

  // Actions
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  completeOnboarding: () => void; // Mark onboarding as complete

  // Git auth actions
  checkGitConfigured: () => Promise<boolean>;
  startFullSetup: () => Promise<void>; // Simple git-based setup

  // Internal
  _unlistenFns: UnlistenFn[];
  _cleanup: () => void;
}

const ONBOARDING_KEY = 'caspian_onboarding_complete';

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  bootState: 'booting',
  user: null,
  isLoading: false,
  error: null,
  setupProgress: null,
  hasCompletedOnboarding: localStorage.getItem(ONBOARDING_KEY) === 'true',
  _unlistenFns: [],

  // Initialize auth state on app startup
  initialize: async () => {
    set({ bootState: 'booting', isLoading: true, error: null });

    // In browser mode, skip to unauthenticated (can't use gh CLI)
    if (!isTauri()) {
      set({
        bootState: 'unauthenticated',
        user: null,
        isLoading: false,
        error: 'GitHub CLI authentication requires the desktop app',
      });
      return;
    }

    try {
      // Set up event listeners for auth events
      const unlistenSuccess = await safeListen<GitHubUser>('auth:success', async (payload) => {
        set({
          bootState: 'authenticated',
          user: payload,
          isLoading: false,
          error: null,
          setupProgress: null,
        });
      });

      const unlistenError = await safeListen<string>('auth:error', (payload) => {
        set({
          isLoading: false,
          error: payload,
          setupProgress: null,
        });
      });

      const unlistenSignedOut = await safeListen<void>('auth:signed_out', () => {
        set({
          bootState: 'unauthenticated',
          user: null,
          isLoading: false,
          error: null,
        });
      });

      const unlistenFns = [unlistenSuccess, unlistenError, unlistenSignedOut]
        .filter((fn): fn is UnlistenFn => fn !== null);
      set({ _unlistenFns: unlistenFns });

      // Check current auth status (checks gh auth status + fetches user)
      const result = await safeInvoke<CommandResult<AuthStatus>>('get_auth_status');

      if (result?.success && result.data) {
        const status = result.data;

        if (status.status === 'authenticated' && status.user) {
          set({
            bootState: 'authenticated',
            user: status.user,
            isLoading: false,
          });
        } else {
          set({
            bootState: 'unauthenticated',
            user: null,
            isLoading: false,
          });
        }
      } else {
        set({
          bootState: 'unauthenticated',
          isLoading: false,
          error: result?.error || 'Failed to get auth status',
        });
      }
    } catch (error) {
      set({
        bootState: 'unauthenticated',
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize auth',
      });
    }
  },

  // Sign out - runs gh auth logout
  signOut: async () => {
    set({ isLoading: true, error: null });

    // In browser mode, just reset state
    if (!isTauri()) {
      set({
        bootState: 'unauthenticated',
        user: null,
        isLoading: false,
      });
      return;
    }

    try {
      const result = await safeInvoke<CommandResult<void>>('sign_out');

      if (result?.success) {
        set({
          bootState: 'unauthenticated',
          user: null,
          isLoading: false,
        });
      } else {
        const errorMsg = result?.error || 'Failed to sign out';
        set({
          isLoading: false,
          error: errorMsg,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to sign out';
      set({
        isLoading: false,
        error: errorMsg,
      });
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Mark onboarding as complete (first-run flow)
  completeOnboarding: () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    set({ hasCompletedOnboarding: true });
  },

  // Git auth actions

  // Check if git is configured with user.name and user.email
  checkGitConfigured: async (): Promise<boolean> => {
    if (!isTauri()) return false;
    try {
      const result = await safeInvoke<CommandResult<boolean>>('check_git_configured');
      return result?.success === true && result.data === true;
    } catch {
      return false;
    }
  },

  // Simple git-based setup flow:
  // 1. Check if git is configured
  // 2. If yes, get user info and mark as authenticated
  // 3. If no, show error with instructions
  startFullSetup: async () => {
    set({ isLoading: true, error: null, setupProgress: 'Checking git configuration...' });

    try {
      // Get user info from git config
      const { data: result, error: ipcError } = await safeInvokeWithError<CommandResult<GitHubUser>>('get_git_user');

      if (ipcError) {
        set({
          isLoading: false,
          setupProgress: null,
          error: `Failed to check git configuration: ${ipcError}`,
        });
        return;
      }

      if (result?.success && result.data) {
        // Mark onboarding complete on successful setup
        localStorage.setItem(ONBOARDING_KEY, 'true');
        set({
          bootState: 'authenticated',
          user: result.data,
          isLoading: false,
          setupProgress: null,
          error: null,
          hasCompletedOnboarding: true,
        });
      } else {
        set({
          isLoading: false,
          setupProgress: null,
          error: result?.error || 'Git is not configured. Please run: git config --global user.name "Your Name" && git config --global user.email "you@example.com"',
        });
      }
    } catch (error) {
      set({
        isLoading: false,
        setupProgress: null,
        error: error instanceof Error ? error.message : 'Setup failed',
      });
    }
  },

  // Cleanup event listeners
  _cleanup: () => {
    const { _unlistenFns } = get();
    _unlistenFns.forEach((unlisten) => unlisten());
    set({ _unlistenFns: [] });
  },
}));
