import { create } from 'zustand';
import { safeInvoke, isTauri } from '../utils/tauri';
import type { Repository, CommandResult, GitCheckResult } from '../types';

interface RepositoryState {
  repositories: Repository[];
  activeRepoId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchRepositories: () => Promise<void>;
  addRepository: (path: string) => Promise<Repository | null>;
  removeRepository: (id: string) => Promise<boolean>;
  setActiveRepo: (id: string | null) => void;
  clearError: () => void;

  // Git operations
  checkGitStatus: (path: string) => Promise<GitCheckResult | null>;
  initRepository: (path: string) => Promise<Repository | null>;
  cloneRepository: (url: string, destination: string) => Promise<Repository | null>;
  createDirectory: (path: string) => Promise<boolean>;
}

const persistActiveRepoId = (id: string | null) => {
  if (typeof localStorage !== 'undefined') {
    if (id) {
      localStorage.setItem('caspian_activeRepoId', id);
    } else {
      localStorage.removeItem('caspian_activeRepoId');
    }
  }
};

// Mock data for browser development
const mockRepositories: Repository[] = [
  {
    id: 'mock-repo-1',
    name: 'Demo Project',
    path: '/Users/demo/projects/demo-project',
    main_branch: 'main',
    path_exists: true,
    created_at: new Date().toISOString(),
    last_accessed_at: new Date().toISOString(),
  },
];

export const useRepositoryStore = create<RepositoryState>((set) => ({
  repositories: [],
  activeRepoId: null,  // Always start fresh - show HomeScreen on app launch
  isLoading: false,
  error: null,

  fetchRepositories: async () => {
    set({ isLoading: true, error: null });

    // Browser mode: return mock data
    if (!isTauri()) {
      set({ repositories: mockRepositories, isLoading: false });
      return;
    }

    try {
      const result = await safeInvoke<CommandResult<Repository[]>>('list_repositories');
      if (result?.success && result.data) {
        set({ repositories: result.data, isLoading: false });
      } else {
        set({ error: result?.error || 'Failed to fetch repositories', isLoading: false });
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addRepository: async (path: string) => {
    set({ isLoading: true, error: null });

    // Browser mode: create mock repo
    if (!isTauri()) {
      const mockRepo: Repository = {
        id: `mock-repo-${Date.now()}`,
        name: path.split('/').pop() || 'New Project',
        path,
        main_branch: 'main',
        path_exists: true,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      };
      persistActiveRepoId(mockRepo.id);
      set((state) => ({
        repositories: [...state.repositories, mockRepo],
        activeRepoId: mockRepo.id,
        isLoading: false,
      }));
      return mockRepo;
    }

    try {
      const result = await safeInvoke<CommandResult<Repository>>('add_repository', { path });
      if (result?.success && result.data) {
        persistActiveRepoId(result.data.id);
        set((state) => ({
          repositories: [...state.repositories, result.data!],
          activeRepoId: result.data!.id,
          isLoading: false,
        }));

        return result.data;
      } else {
        set({ error: result?.error || 'Failed to add repository', isLoading: false });
        return null;
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  removeRepository: async (id: string) => {
    // Browser mode: remove from state
    if (!isTauri()) {
      set((state) => ({
        repositories: state.repositories.filter((r) => r.id !== id),
        activeRepoId: state.activeRepoId === id ? null : state.activeRepoId,
      }));
      return true;
    }

    try {
      const result = await safeInvoke<CommandResult<void>>('remove_repository', { id });
      if (result?.success) {
        set((state) => ({
          repositories: state.repositories.filter((r) => r.id !== id),
          activeRepoId: state.activeRepoId === id ? null : state.activeRepoId,
        }));

        return true;
      } else {
        set({ error: result?.error || 'Failed to remove repository' });
        return false;
      }
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },

  setActiveRepo: (id: string | null) => {
    persistActiveRepoId(id);
    set({ activeRepoId: id });

    if (id && isTauri()) {
      safeInvoke('update_last_accessed', { id }).catch(() => {});
    }
  },

  clearError: () => set({ error: null }),

  // Git operations
  checkGitStatus: async (path: string) => {
    // Browser mode: return mock git status
    if (!isTauri()) {
      return { is_git_repo: true, has_commits: true, path } as GitCheckResult;
    }

    try {
      const result = await safeInvoke<CommandResult<GitCheckResult>>('check_git_status', { path });
      if (result?.success && result.data) {
        return result.data;
      } else {
        set({ error: result?.error || 'Failed to check git status' });
        return null;
      }
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  initRepository: async (path: string) => {
    set({ isLoading: true, error: null });

    // Browser mode: create mock initialized repo
    if (!isTauri()) {
      const mockRepo: Repository = {
        id: `mock-repo-${Date.now()}`,
        name: path.split('/').pop() || 'New Project',
        path,
        main_branch: 'main',
        path_exists: true,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      };
      persistActiveRepoId(mockRepo.id);
      set((state) => ({
        repositories: [...state.repositories, mockRepo],
        activeRepoId: mockRepo.id,
        isLoading: false,
      }));
      return mockRepo;
    }

    try {
      const result = await safeInvoke<CommandResult<Repository>>('init_repository', { path });
      if (result?.success && result.data) {
        persistActiveRepoId(result.data.id);
        set((state) => ({
          repositories: [...state.repositories, result.data!],
          activeRepoId: result.data!.id,
          isLoading: false,
        }));
        return result.data;
      } else {
        set({ error: result?.error || 'Failed to initialize repository', isLoading: false });
        return null;
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  cloneRepository: async (url: string, destination: string) => {
    set({ isLoading: true, error: null });

    // Browser mode: create mock cloned repo
    if (!isTauri()) {
      const repoName = url.split('/').pop()?.replace('.git', '') || 'cloned-repo';
      const mockRepo: Repository = {
        id: `mock-repo-${Date.now()}`,
        name: repoName,
        path: `${destination}/${repoName}`,
        main_branch: 'main',
        path_exists: true,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      };
      persistActiveRepoId(mockRepo.id);
      set((state) => ({
        repositories: [...state.repositories, mockRepo],
        activeRepoId: mockRepo.id,
        isLoading: false,
      }));
      return mockRepo;
    }

    try {
      const result = await safeInvoke<CommandResult<Repository>>('clone_repository', { url, destination });
      if (result?.success && result.data) {
        persistActiveRepoId(result.data.id);
        set((state) => ({
          repositories: [...state.repositories, result.data!],
          activeRepoId: result.data!.id,
          isLoading: false,
        }));
        return result.data;
      } else {
        set({ error: result?.error || 'Failed to clone repository', isLoading: false });
        return null;
      }
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return null;
    }
  },

  createDirectory: async (path: string) => {
    // Browser mode: return success
    if (!isTauri()) {
      return true;
    }

    try {
      const result = await safeInvoke<CommandResult<void>>('create_directory', { path });
      if (result?.success) {
        return true;
      } else {
        set({ error: result?.error || 'Failed to create directory' });
        return false;
      }
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },
}));
