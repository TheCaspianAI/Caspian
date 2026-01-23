import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'state-change';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  nodeId?: string;
  duration: number;
}

interface ToastInput {
  type: ToastType;
  title: string;
  message: string;
  nodeId?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (input: ToastInput) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = input.duration ?? 5000;

    const toast: Toast = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      nodeId: input.nodeId,
      duration,
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));
