import { create } from "zustand";
import { supabase } from "../lib/supabase";

// Central de notificações (Fase 4.11) — populada por create_notification (security definer),
// chamada pelo client logo após ações relevantes (aceite de delegação, resolução de prazo).
export const useNotificationStore = create((set, get) => ({
  notifications: [],

  fetchNotifications: async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) { console.error("fetchNotifications:", error.message); return; }
    set({ notifications: data ?? [] });
  },

  markAsRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    }));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  },

  markAllRead: async () => {
    const unreadIds = get().notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    set((s) => ({
      notifications: s.notifications.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    }));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  },

  // Chamado depois de ações relevantes (ver taskStore.js) — nunca notifica o próprio autor da ação.
  notify: async (userId, type, title, taskId = null) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!userId || userId === authData?.user?.id) return;
    const { error } = await supabase.rpc("create_notification", {
      p_user_id: userId, p_type: type, p_title: title, p_task_id: taskId,
    });
    if (error) console.error("notify:", error.message);
  },
}));
