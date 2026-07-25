import { create } from "zustand";
import { supabase } from "../lib/supabase";

// Backlog de ideias do desenvolvedor (Painel Admin > Ideias & Roadmap). RLS trava tudo em
// is_admin() — sem policy pra ninguém além do admin, então nem precisa filtrar por usuário aqui.
export const useDevIdeasStore = create((set, get) => ({
  ideas: [],
  loading: false,

  fetchIdeas: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("dev_ideas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchIdeas:", error.message); set({ loading: false }); return; }
    set({ ideas: data ?? [], loading: false });
  },

  addIdea: async (title) => {
    const clean = title.trim();
    if (!clean) return;
    const { data, error } = await supabase
      .from("dev_ideas")
      .insert([{ title: clean }])
      .select()
      .single();
    if (error) { console.error("addIdea:", error.message); return; }
    set((s) => ({ ideas: [data, ...s.ideas] }));
  },

  updateIdea: async (id, patch) => {
    set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
    const { error } = await supabase
      .from("dev_ideas")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("updateIdea:", error.message); get().fetchIdeas(); }
  },

  deleteIdea: async (id) => {
    set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }));
    const { error } = await supabase.from("dev_ideas").delete().eq("id", id);
    if (error) { console.error("deleteIdea:", error.message); get().fetchIdeas(); }
  },
}));
