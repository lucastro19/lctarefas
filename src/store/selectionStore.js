import { create } from "zustand";

export const useSelectionStore = create((set, get) => ({
  selectedIds: [],

  toggle: (id) => {
    const { selectedIds } = get();
    set({
      selectedIds: selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id],
    });
  },

  selectAll: (ids) => set({ selectedIds: ids }),
  clearAll: () => set({ selectedIds: [] }),
  isSelected: (id) => get().selectedIds.includes(id),
}));
