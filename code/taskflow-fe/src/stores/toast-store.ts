import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastInput {
  title: string;
  body?: string;
  variant?: ToastVariant;
  durationMs?: number;
  /** Tuỳ chọn: href để điều hướng khi click (dùng cho react-router) */
  href?: string;
  onClick?: () => void;
}

export interface Toast extends ToastInput {
  id: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: ToastInput) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let counter = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = counter++;
    const toast: Toast = {
      id,
      createdAt: Date.now(),
      variant: t.variant ?? 'info',
      durationMs: t.durationMs ?? 5000,
      ...t,
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
