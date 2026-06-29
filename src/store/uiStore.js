import { create } from "zustand";

export const useUiStore = create((set) => ({
  pendingTask: null,
  openTask: (task) => set({ pendingTask: task }),
  clearPendingTask: () => set({ pendingTask: null }),

  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  expandedTaskId: null,
  setExpandedTaskId: (id) => set({ expandedTaskId: id }),

  showQuickEntry: false,
  openQuickEntry: () => set({ showQuickEntry: true }),
  closeQuickEntry: () => set({ showQuickEntry: false }),
  toggleQuickEntry: () => set((s) => ({ showQuickEntry: !s.showQuickEntry })),

  showDrawer: false,
  openDrawer: () => set({ showDrawer: true }),
  closeDrawer: () => set({ showDrawer: false }),

  showSearch: false,
  openSearch: () => set({ showSearch: true }),
  closeSearch: () => set({ showSearch: false }),

  toasts: [],
  showToast: ({ message, action, onAction, duration = 4500 }) => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, action, onAction }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
