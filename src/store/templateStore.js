import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useTemplateStore = create(
  persist(
    (set, get) => ({
      templates: [],

      saveTemplate: (task) => {
        const template = {
          id: `tpl_${Date.now()}`,
          name: task.title,
          fields: {
            title: task.title,
            notes: task.notes ?? "",
            priority: task.priority ?? null,
            recurrence: task.recurrence ?? null,
          },
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ templates: [...s.templates, template] }));
        return template;
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      renameTemplate: (id, name) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, name } : t)),
        })),
    }),
    { name: "lctarefas-templates" }
  )
);
