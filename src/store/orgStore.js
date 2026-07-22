import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export const ROLE_LABELS = {
  estrategico: "Estratégico",
  supervisor: "Supervisor",
  membro: "Membro",
};

export const useOrgStore = create((set, get) => ({
  organization: null,   // a org do usuário atual (dono ou convidado)
  members: [],          // org_members da org atual (com perfil embutido quando possível)
  invites: [],          // convites da org (para o dono ver pendentes)
  loading: false,
  loaded: false,        // já tentou buscar ao menos uma vez

  // Busca a org do usuário atual pela linha em org_members.
  // Dono e convidado têm linha em org_members, então o caminho é o mesmo.
  fetchOrganization: async () => {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;
    set({ loading: true });

    // limit(1): robusto caso o usuário venha a pertencer a mais de uma org no futuro
    const { data: membership, error } = await supabase
      .from("org_members")
      .select("id, org_id, role, manager_id, organizations(*)")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (error) console.error("fetchOrganization error:", error);

    const organization = membership?.organizations ?? null;
    set({ organization, loading: false, loaded: true });

    if (organization) {
      get().fetchMembers();
      // Só o dono consegue listar convites (RLS); tudo bem falhar silencioso.
      if (organization.owner_id === user.id) get().fetchInvites();
    }
    return organization;
  },

  createOrganization: async (name) => {
    const user = useAuthStore.getState().user;
    if (!user?.id || !name?.trim()) return null;

    const { data: org, error: e1 } = await supabase
      .from("organizations")
      .insert([{ name: name.trim(), owner_id: user.id }])
      .select()
      .single();
    if (e1) { console.error("createOrganization error:", e1); return null; }

    // O dono entra como estratégico, topo da árvore.
    const { error: e2 } = await supabase
      .from("org_members")
      .insert([{ org_id: org.id, user_id: user.id, role: "estrategico", manager_id: null }]);
    if (e2) console.error("createOrganization member error:", e2);

    set({ organization: org });
    get().fetchMembers();
    return org;
  },

  fetchMembers: async () => {
    const org = get().organization;
    if (!org) return;
    const { data, error } = await supabase
      .from("org_members")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at");
    if (error) { console.error("fetchMembers error:", error); return; }

    const members = data ?? [];
    // org_members.user_id -> profiles não é FK direta (via auth.users), então
    // buscamos os perfis à parte e anexamos. Liberado pela policy profile_select_orgmate.
    const ids = members.map((m) => m.user_id);
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", ids);
      const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      members.forEach((m) => { m.profile = byId[m.user_id] ?? null; });
    }
    set({ members });
  },

  fetchInvites: async () => {
    const org = get().organization;
    if (!org) return;
    const { data, error } = await supabase
      .from("org_invites")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });
    if (error) { console.error("fetchInvites error:", error); return; }
    set({ invites: data ?? [] });
  },

  inviteMember: async ({ email, role, managerId = null }) => {
    const user = useAuthStore.getState().user;
    const org = get().organization;
    if (!user?.id || !org) return null;

    const { data, error } = await supabase
      .from("org_invites")
      .insert([{
        org_id: org.id,
        email: email.trim().toLowerCase(),
        role,
        manager_id: managerId,
        invited_by: user.id,
      }])
      .select()
      .single();
    if (error) { console.error("inviteMember error:", error); return null; }

    set((s) => ({ invites: [data, ...s.invites] }));
    return data;
  },

  revokeInvite: async (id) => {
    const { error } = await supabase
      .from("org_invites")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) { console.error("revokeInvite error:", error); return; }
    set((s) => ({ invites: s.invites.map((i) => (i.id === id ? { ...i, status: "revoked" } : i)) }));
  },

  // Retorna { orgId } em sucesso, ou lança o erro do Postgres (mensagem amigável).
  acceptInvite: async (token) => {
    const { data, error } = await supabase.rpc("accept_org_invite", { p_token: token });
    if (error) throw error;
    await get().fetchOrganization();
    return data; // org_id
  },

  inviteLink: (token) => `${window.location.origin}/convite/${token}`,

  getMemberByUserId: (userId) => get().members.find((m) => m.user_id === userId) ?? null,
}));
