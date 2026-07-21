import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export const COLLABORATOR_COLORS = [
  "#AF52DE", "#4F8EF7", "#34C759", "#FF9500",
  "#FF2D55", "#00BFA5", "#FFCC00", "#5856D6",
];

export const useCollaboratorStore = create((set, get) => ({
  collaborators: [],
  loading: false,

  fetchCollaborators: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("collaborators")
      .select("*")
      .is("archived_at", null)
      .is("deleted_at", null)
      .order("position");
    if (error) console.error("fetchCollaborators error:", error);
    set({ collaborators: data ?? [], loading: false });
  },

  fetchArchivedCollaborators: async () => {
    const { data } = await supabase
      .from("collaborators")
      .select("*")
      .not("archived_at", "is", null)
      .is("deleted_at", null)
      .order("archived_at", { ascending: false });
    return data ?? [];
  },

  createCollaborator: async (fields) => {
    const user = useAuthStore.getState().user;
    if (!user?.id) return null;
    const pos = get().collaborators.length;
    const { data, error } = await supabase
      .from("collaborators")
      .insert([{
        color: COLLABORATOR_COLORS[pos % COLLABORATOR_COLORS.length],
        ...fields,
        phone: normalizePhone(fields.phone),
        position: pos,
        user_id: user.id,
      }])
      .select()
      .single();
    if (error) console.error("createCollaborator error:", error);
    if (data) set((s) => ({ collaborators: [...s.collaborators, data] }));
    return data;
  },

  updateCollaborator: async (id, fields) => {
    const payload = "phone" in fields ? { ...fields, phone: normalizePhone(fields.phone) } : fields;
    // Otimismo local — o formulário fecha na hora
    set((s) => ({
      collaborators: s.collaborators.map((c) => (c.id === id ? { ...c, ...payload } : c)),
    }));
    const { data, error } = await supabase
      .from("collaborators").update(payload).eq("id", id).select().single();
    if (error) console.error("updateCollaborator error:", error);
    if (data) set((s) => ({ collaborators: s.collaborators.map((c) => (c.id === id ? data : c)) }));
    return data;
  },

  archiveCollaborator: async (id) => {
    set((s) => ({ collaborators: s.collaborators.filter((c) => c.id !== id) }));
    await supabase.from("collaborators")
      .update({ archived_at: new Date().toISOString() }).eq("id", id);
  },

  unarchiveCollaborator: async (id) => {
    await supabase.from("collaborators").update({ archived_at: null }).eq("id", id);
    await get().fetchCollaborators();
  },

  // Soft-delete: colaborador nunca some do banco (tarefas antigas mantêm o histórico)
  deleteCollaborator: async (id) => {
    set((s) => ({ collaborators: s.collaborators.filter((c) => c.id !== id) }));
    await supabase.from("collaborators")
      .update({ deleted_at: new Date().toISOString() }).eq("id", id);
  },

  restoreCollaborator: async (id) => {
    await supabase.from("collaborators").update({ deleted_at: null }).eq("id", id);
    await get().fetchCollaborators();
  },

  reorderCollaborators: async (ordered) => {
    set({ collaborators: ordered.map((c, i) => ({ ...c, position: i })) });
    await Promise.all(
      ordered.map((c, i) => supabase.from("collaborators").update({ position: i }).eq("id", c.id))
    );
  },

  getById: (id) => get().collaborators.find((c) => c.id === id) ?? null,
}));

// Guarda só dígitos — é o formato que o wa.me espera (ex.: 5531999998888)
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits || null;
}
