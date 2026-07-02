import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useTagStore = create((set, get) => ({
  tags: [],
  taskTags: {},

  fetchTags: async () => {
    const { data } = await supabase.from("tags").select("*").order("name");
    set({ tags: data ?? [] });
  },

  fetchTaskTags: async (taskId) => {
    const { data } = await supabase
      .from("task_tags")
      .select("tag_id, tags(id, name, color)")
      .eq("task_id", taskId);
    const tags = data?.map((r) => r.tags).filter(Boolean) ?? [];
    set((s) => ({ taskTags: { ...s.taskTags, [taskId]: tags } }));
  },

  createTag: async (name, color = "#8E8E93") => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("tags")
      .insert([{ name, color, user_id: user.id }])
      .select()
      .single();
    if (data) set((s) => ({ tags: [...s.tags, data] }));
    return data;
  },

  addTagToTask: async (taskId, tagId) => {
    await supabase.from("task_tags").insert([{ task_id: taskId, tag_id: tagId }]);
    const tag = get().tags.find((t) => t.id === tagId);
    if (tag)
      set((s) => ({
        taskTags: { ...s.taskTags, [taskId]: [...(s.taskTags[taskId] ?? []), tag] },
      }));
  },

  fetchTagTasks: async (tagId) => {
    const { data } = await supabase
      .from("task_tags")
      .select("task_id")
      .eq("tag_id", tagId);
    return data?.map((r) => r.task_id) ?? [];
  },

  removeTagFromTask: async (taskId, tagId) => {
    await supabase.from("task_tags").delete().eq("task_id", taskId).eq("tag_id", tagId);
    set((s) => ({
      taskTags: {
        ...s.taskTags,
        [taskId]: (s.taskTags[taskId] ?? []).filter((t) => t.id !== tagId),
      },
    }));
  },

  updateTag: async (tagId, fields) => {
    const { data } = await supabase.from("tags").update(fields).eq("id", tagId).select().single();
    if (data) set((s) => ({
      tags: s.tags.map((t) => (t.id === tagId ? data : t)),
      taskTags: Object.fromEntries(
        Object.entries(s.taskTags).map(([tid, tags]) => [
          tid, tags.map((t) => (t.id === tagId ? { ...t, ...fields } : t))
        ])
      ),
    }));
  },

  deleteTag: async (tagId) => {
    await supabase.from("task_tags").delete().eq("tag_id", tagId);
    await supabase.from("tags").delete().eq("id", tagId);
    set((s) => ({
      tags: s.tags.filter((t) => t.id !== tagId),
      taskTags: Object.fromEntries(
        Object.entries(s.taskTags).map(([tid, tags]) => [
          tid, tags.filter((t) => t.id !== tagId)
        ])
      ),
    }));
  },
}));
