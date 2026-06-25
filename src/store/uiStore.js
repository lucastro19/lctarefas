import { create } from "zustand";

export const useUiStore = create((set) => ({
  pendingTask: null,
  openTask: (task) => set({ pendingTask: task }),
  clearPendingTask: () => set({ pendingTask: null }),

  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  expandedTaskId: null,
  setExpandedTaskId: (id) => set({ expandedTaskId: id }),
}));
