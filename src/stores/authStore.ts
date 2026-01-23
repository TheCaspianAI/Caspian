import { create } from 'zustand';
import { safeInvoke, safeListen, isTauri } from '../utils/tauri';

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

  // Actions
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;

  // gh CLI actions
  checkGhCliInstalled: () => Promise<boolean>;
  checkGhCliAuth: () => Promise<boolean>;
  installGhCli: () => Promise<boolean>;
  startFullSetup: () => Promise<void>; // Full onboarding flow

  // Internal
  _unlistenFns: UnlistenFn[];
  _cleanup: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  bootState: 'booting',
  user: null,
  isLoading: false,
  error: null,
  setupProgress: null,
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

  // gh CLI actions

  // Check if gh CLI is installed
  checkGhCliInstalled: async (): Promise<boolean> => {
    if (!isTauri()) return false;
    try {
      const result = await safeInvoke<CommandResult<boolean>>('check_gh_cli_installed');
      return result?.success === true && result.data === true;
    } catch {
      return false;
    }
  },

  // Check if gh CLI is authenticated
  checkGhCliAuth: async (): Promise<boolean> => {
    if (!isTauri()) return false;
    try {
      const result = await safeInvoke<CommandResult<boolean>>('check_gh_cli_auth');
      return result?.success === true && result.data === true;
    } catch {
      return false;
    }
  },

  // Install gh CLI
  installGhCli: async () => {
    if (!isTauri()) return false;
    try {
      const result = await safeInvoke<CommandResult<void>>('install_gh_cli');
      return result?.success === true;
    } catch {
      return false;
    }
  },

  // Full onboarding flow:
  // 1. Check/install gh CLI
  // 2. Check if already authenticated -> done
  // 3. Run gh auth login --web -> wait for result
  startFullSetup: async () => {
    const { checkGhCliInstalled, installGhCli, checkGhCliAuth } = get();
    set({ isLoading: true, error: null, setupProgress: 'Checking GitHub CLI...' });

    try {
      // Step 1: Check if gh CLI is installed
      const ghInstalled = await checkGhCliInstalled();

      if (!ghInstalled) {
        set({ setupProgress: 'Installing GitHub CLI...' });
        const installed = await installGhCli();
        if (!installed) {
          set({
            isLoading: false,
            setupProgress: null,
            error: 'Failed to install GitHub CLI. Please install it manually from https://cli.github.com',
          });
          return;
        }
      }

      // Step 2: Check if already authenticated
      set({ setupProgress: 'Checking authentication...' });
      const isAuthed = await checkGhCliAuth();

      if (isAuthed) {
        // Already authenticated, fetch user and complete
        set({ setupProgress: 'Fetching user info...' });
        const result = await safeInvoke<CommandResult<AuthStatus>>('get_auth_status');

        if (result?.success && result.data?.status === 'authenticated' && result.data.user) {
          set({
            bootState: 'authenticated',
            user: result.data.user,
            isLoading: false,
            setupProgress: null,
            error: null,
          });
          return;
        }
      }

      // Step 3: Run gh auth login --web (opens browser)
      set({ setupProgress: 'Opening browser for GitHub login...' });
      const loginResult = await safeInvoke<CommandResult<GitHubUser>>('run_gh_auth_login');

      if (loginResult?.success && loginResult.data) {
        set({
          bootState: 'authenticated',
          user: loginResult.data,
          isLoading: false,
          setupProgress: null,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          setupProgress: null,
          error: loginResult?.error || 'Authentication failed',
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
