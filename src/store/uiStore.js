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
}));
