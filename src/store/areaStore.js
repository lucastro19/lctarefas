import { create } from "zustand";
import { supabase } from "../lib/supabase";

const THIRTY_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
};

export const useAreaStore = create((set, get) => ({
  areas: [],
  projects: [],
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    const [{ data: areas }, { data: projects }] = await Promise.all([
      supabase.from("areas").select("*").is("archived_at", null).is("deleted_at", null).order("position"),
      supabase.from("projects").select("*").is("archived_at", null).is("deleted_at", null).order("position"),
    ]);
    set({ areas: areas ?? [], projects: projects ?? [], loading: false });
  },

  fetchArchived: async () => {
    const [{ data: areas }, { data: projects }] = await Promise.all([
      supabase.from("areas").select("*").not("archived_at", "is", null).is("deleted_at", null).order("archived_at", { ascending: false }),
      supabase.from("projects").select("*, areas(name, color)").not("archived_at", "is", null).is("deleted_at", null).order("archived_at", { ascending: false }),
    ]);
    return { archivedAreas: areas ?? [], archivedProjects: projects ?? [] };
  },

  fetchTrashData: async () => {
    const limit = THIRTY_DAYS_AGO();

    // Sem cascade: cada item deletado foi deletado individualmente
    const [{ data: areas, error: e1 }, { data: projects, error: e2 }, { data: tasks, error: e3 }] = await Promise.all([
      supabase.from("areas").select("*")
        .not("deleted_at", "is", null).gte("deleted_at", limit)
        .order("deleted_at", { ascending: false }),

      supabase.from("projects").select("*, areas(id, name, color)")
        .not("deleted_at", "is", null).gte("deleted_at", limit)
        .order("deleted_at", { ascending: false }),

      supabase.from("tasks").select("*, projects(id, name, color), areas(id, name, color)")
        .not("deleted_at", "is", null).gte("deleted_at", limit)
        .order("deleted_at", { ascending: false }),
    ]);

    if (e1) console.error("fetchTrashData areas:", e1);
    if (e2) console.error("fetchTrashData projects:", e2);
    if (e3) console.error("fetchTrashData tasks:", e3);

    return { deletedAreas: areas ?? [], deletedProjects: projects ?? [], deletedTasks: tasks ?? [] };
  },

  // Areas
  createArea: async (name, color = "#4F8EF7") => {
    const { data: { user } } = await supabase.auth.getUser();
    const pos = get().areas.length;
    const { data, error } = await supabase
      .from("areas")
      .insert([{ name, color, position: pos, user_id: user.id }])
      .select()
      .single();
    if (error) console.error("createArea error:", error);
    if (data) set((s) => ({ areas: [...s.areas, data] }));
    return data;
  },

  updateArea: async (id, fields) => {
    const { data } = await supabase.from("areas").update(fields).eq("id", id).select().single();
    if (data) set((s) => ({ areas: s.areas.map((a) => (a.id === id ? data : a)) }));
  },

  archiveArea: async (id) => {
    await supabase.from("areas").update({ archived_at: new Date().toISOString() }).eq("id", id);
    set((s) => ({ areas: s.areas.filter((a) => a.id !== id) }));
  },

  unarchiveArea: async (id) => {
    await supabase.from("areas").update({ archived_at: null }).eq("id", id);
  },

  deleteArea: async (id) => {
    await supabase.from("areas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    set((s) => ({
      areas: s.areas.filter((a) => a.id !== id),
      projects: s.projects.filter((p) => p.area_id !== id),
    }));
  },

  restoreArea: async (id) => {
    await supabase.from("areas").update({ deleted_at: null }).eq("id", id);
  },

  permanentDeleteArea: async (id) => {
    await supabase.from("areas").delete().eq("id", id);
  },

  // Projects
  createProject: async (areaId, name, color = "#34C759") => {
    const { data: { user } } = await supabase.auth.getUser();
    const pos = get().projects.filter((p) => p.area_id === areaId).length;
    const { data, error } = await supabase
      .from("projects")
      .insert([{ area_id: areaId, name, color, position: pos, user_id: user.id }])
      .select()
      .single();
    if (error) console.error("createProject error:", error);
    if (data) set((s) => ({ projects: [...s.projects, data] }));
    return data;
  },

  updateProject: async (id, fields) => {
    const { data } = await supabase.from("projects").update(fields).eq("id", id).select().single();
    if (data) set((s) => ({ projects: s.projects.map((p) => (p.id === id ? data : p)) }));
  },

  archiveProject: async (id) => {
    await supabase.from("projects").update({ archived_at: new Date().toISOString() }).eq("id", id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  unarchiveProject: async (id) => {
    await supabase.from("projects").update({ archived_at: null }).eq("id", id);
  },

  deleteProject: async (id) => {
    await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  restoreProject: async (id) => {
    await supabase.from("projects").update({ deleted_at: null }).eq("id", id);
  },

  permanentDeleteProject: async (id) => {
    await supabase.from("projects").delete().eq("id", id);
  },

  getProjectsByArea: (areaId) => get().projects.filter((p) => p.area_id === areaId),
}));
