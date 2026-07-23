import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

export const ROLE_LABELS = {
  estrategico: "Estratégico",
  supervisor: "Supervisor",
  membro: "Membro",
};

// Paleta para tipos de demanda (mesma vibe das cores de colaborador/tags)
export const DEMAND_COLORS = [
  "#4F8EF7", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55", "#5AC8FA", "#8E8E93",
];

export const useOrgStore = create((set, get) => ({
  organization: null,   // a org do usuário atual (dono ou convidado)
  members: [],          // org_members da org atual (com perfil embutido quando possível)
  invites: [],          // convites da org (para o dono ver pendentes)
  teams: [],            // times da org (com team_members embutidos)
  demandTypes: [],      // tipos de demanda da org
  teamTasks: [],        // roll-up hierárquico p/ o Cockpit (Fase 2.5) — tarefas da equipe, não as minhas
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
      get().fetchTeams();
      get().fetchDemandTypes();
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

  // ─── Cockpit do gestor (Fase 2.5) ───
  // Roll-up hierárquico: a RLS de tasks (Fase 2.1, is_manager_of) já garante que só voltam
  // linhas que o usuário tem direito de ver (próprias + da árvore de reporte). Aqui só filtramos
  // por org e removemos o que é execução pessoal do próprio gestor (assignee_id === eu) — isso já
  // aparece nas listas pessoais dele; o cockpit é só o trabalho de terceiros.
  fetchTeamTasks: async () => {
    const org = get().organization;
    const uid = useAuthStore.getState().user?.id;
    if (!org || !uid) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*, projects(deleted_at), areas(deleted_at)")
      .eq("org_id", org.id)
      .is("deleted_at", null)
      .is("completed_at", null)
      .is("archived_at", null)
      .order("delegated_at", { ascending: false });
    if (error) { console.error("fetchTeamTasks error:", error); return; }

    const teamTasks = (data ?? [])
      .filter((t) => !t.projects?.deleted_at && !t.areas?.deleted_at)
      .filter((t) => t.assignee_id !== uid)
      .map(({ projects: _p, areas: _a, ...t }) => t);
    set({ teamTasks });
  },

  // ─── Gestão de membros (só o dono; coberto por org_members_owner_*) ───
  updateMemberRole: async (memberId, role) => {
    set((s) => ({ members: s.members.map((m) => (m.id === memberId ? { ...m, role } : m)) }));
    const { error } = await supabase.from("org_members").update({ role }).eq("id", memberId);
    if (error) { console.error("updateMemberRole error:", error); get().fetchMembers(); }
  },

  updateMemberManager: async (memberId, managerId) => {
    const mgr = managerId || null;
    set((s) => ({ members: s.members.map((m) => (m.id === memberId ? { ...m, manager_id: mgr } : m)) }));
    const { error } = await supabase.from("org_members").update({ manager_id: mgr }).eq("id", memberId);
    if (error) { console.error("updateMemberManager error:", error); get().fetchMembers(); }
  },

  removeMember: async (memberId) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
    const { error } = await supabase.from("org_members").delete().eq("id", memberId);
    if (error) { console.error("removeMember error:", error); get().fetchMembers(); }
    // Times podem ter perdido membros/líder (FK on delete): ressincroniza
    get().fetchTeams();
  },

  // ─── Times ───
  fetchTeams: async () => {
    const org = get().organization;
    if (!org) return;
    const { data, error } = await supabase
      .from("teams")
      .select("*, team_members(org_member_id)")
      .eq("org_id", org.id)
      .order("created_at");
    if (error) { console.error("fetchTeams error:", error); return; }
    set({ teams: data ?? [] });
  },

  createTeam: async (name) => {
    const org = get().organization;
    if (!org || !name?.trim()) return null;
    const { data, error } = await supabase
      .from("teams")
      .insert([{ org_id: org.id, name: name.trim() }])
      .select("*, team_members(org_member_id)")
      .single();
    if (error) { console.error("createTeam error:", error); return null; }
    set((s) => ({ teams: [...s.teams, data] }));
    return data;
  },

  renameTeam: async (id, name) => {
    if (!name?.trim()) return;
    set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, name: name.trim() } : t)) }));
    const { error } = await supabase.from("teams").update({ name: name.trim() }).eq("id", id);
    if (error) { console.error("renameTeam error:", error); get().fetchTeams(); }
  },

  setTeamLead: async (id, orgMemberId) => {
    const lead = orgMemberId || null;
    set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, lead_id: lead } : t)) }));
    const { error } = await supabase.from("teams").update({ lead_id: lead }).eq("id", id);
    if (error) { console.error("setTeamLead error:", error); get().fetchTeams(); }
  },

  deleteTeam: async (id) => {
    set((s) => ({ teams: s.teams.filter((t) => t.id !== id) }));
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) { console.error("deleteTeam error:", error); get().fetchTeams(); }
  },

  addTeamMember: async (teamId, orgMemberId) => {
    const { error } = await supabase
      .from("team_members")
      .insert([{ team_id: teamId, org_member_id: orgMemberId }]);
    if (error) { console.error("addTeamMember error:", error); }
    get().fetchTeams();
  },

  removeTeamMember: async (teamId, orgMemberId) => {
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("org_member_id", orgMemberId);
    if (error) { console.error("removeTeamMember error:", error); }
    get().fetchTeams();
  },

  // ─── Tipos de demanda ───
  fetchDemandTypes: async () => {
    const org = get().organization;
    if (!org) return;
    const { data, error } = await supabase
      .from("demand_types")
      .select("*")
      .eq("org_id", org.id)
      .order("label");
    if (error) { console.error("fetchDemandTypes error:", error); return; }
    set({ demandTypes: data ?? [] });
  },

  createDemandType: async ({ key, label, color }) => {
    const org = get().organization;
    if (!org || !label?.trim()) return null;
    // key = slug do label quando não informado (unique por org)
    const slug = (key?.trim() || label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    const { data, error } = await supabase
      .from("demand_types")
      .insert([{ org_id: org.id, key: slug, label: label.trim(), color: color ?? DEMAND_COLORS[0] }])
      .select()
      .single();
    if (error) { console.error("createDemandType error:", error); return null; }
    set((s) => ({ demandTypes: [...s.demandTypes, data].sort((a, b) => a.label.localeCompare(b.label)) }));
    return data;
  },

  updateDemandType: async (id, fields) => {
    set((s) => ({ demandTypes: s.demandTypes.map((d) => (d.id === id ? { ...d, ...fields } : d)) }));
    const { error } = await supabase.from("demand_types").update(fields).eq("id", id);
    if (error) { console.error("updateDemandType error:", error); get().fetchDemandTypes(); }
  },

  archiveDemandType: async (id) => {
    const archived_at = new Date().toISOString();
    set((s) => ({ demandTypes: s.demandTypes.map((d) => (d.id === id ? { ...d, archived_at } : d)) }));
    const { error } = await supabase.from("demand_types").update({ archived_at }).eq("id", id);
    if (error) { console.error("archiveDemandType error:", error); get().fetchDemandTypes(); }
  },

  unarchiveDemandType: async (id) => {
    set((s) => ({ demandTypes: s.demandTypes.map((d) => (d.id === id ? { ...d, archived_at: null } : d)) }));
    const { error } = await supabase.from("demand_types").update({ archived_at: null }).eq("id", id);
    if (error) { console.error("unarchiveDemandType error:", error); get().fetchDemandTypes(); }
  },

  // ─── Configurações da org (gamificação/alertas — §09/§10, inerte por ora) ───
  updateOrgSettings: async (patch) => {
    const org = get().organization;
    if (!org) return;
    const next = { ...(org.settings ?? {}), ...patch };
    set({ organization: { ...org, settings: next } });
    const { error } = await supabase.from("organizations").update({ settings: next }).eq("id", org.id);
    if (error) { console.error("updateOrgSettings error:", error); }
  },
}));
