import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";

const ROLE_LABELS = {
  free:  { label: "Free",  color: "text-text-secondary bg-border/60" },
  pro:   { label: "Pro",   color: "text-primary bg-primary/10 border border-primary/30" },
  admin: { label: "Admin", color: "text-danger bg-danger/10 border border-danger/30" },
};

function RoleBadge({ role }) {
  const cfg = ROLE_LABELS[role] ?? ROLE_LABELS.free;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function Avatar({ name, url, size = 8 }) {
  if (url) return <img src={url} alt={name} className={`w-${size} h-${size} rounded-full object-cover`} />;
  const initials = (name ?? "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`w-${size} h-${size} rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

function StatCard({ label, value, color = "text-text-main" }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

export function AdminPage() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmSuspend, setConfirmSuspend] = useState(null);

  // Redireciona se não for admin
  useEffect(() => {
    if (profile && profile.role !== "admin") navigate("/today", { replace: true });
  }, [profile]);

  const loadUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.rpc("admin_list_users");
      if (err) throw err;
      setUsers(data ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === "admin") loadUsers();
  }, [profile]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const stats = useMemo(() => ({
    total: users.length,
    pro:   users.filter((u) => u.role === "pro").length,
    admin: users.filter((u) => u.role === "admin").length,
    suspended: users.filter((u) => u.suspended_at).length,
  }), [users]);

  const setRole = async (userId, role) => {
    setActionLoading(userId + "_role");
    try {
      const { error: err } = await supabase.rpc("admin_set_user_role", {
        target_id: userId,
        new_role: role,
      });
      if (err) throw err;
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSuspend = async (user) => {
    const willSuspend = !user.suspended_at;
    if (willSuspend) {
      setConfirmSuspend(user);
      return;
    }
    doSuspend(user.id, false);
  };

  const doSuspend = async (userId, suspend) => {
    setConfirmSuspend(null);
    setActionLoading(userId + "_suspend");
    try {
      const { error: err } = await supabase.rpc("admin_toggle_suspend", {
        target_id: userId,
        suspend,
      });
      if (err) throw err;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, suspended_at: suspend ? new Date().toISOString() : null }
            : u
        )
      );
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (!profile || profile.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/today")}
            className="text-sm text-text-secondary hover:text-text-main transition-colors"
          >
            ← Voltar
          </button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-base font-semibold text-text-main">Painel Admin</h1>
          <span className="text-[10px] font-bold bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded-full">
            ADMIN
          </span>
        </div>
        <button
          onClick={loadUsers}
          className="text-xs text-primary hover:underline"
          disabled={loading}
        >
          {loading ? "Carregando…" : "↺ Atualizar"}
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total de usuários" value={stats.total} />
          <StatCard label="Plano Pro" value={stats.pro} color="text-primary" />
          <StatCard label="Admins" value={stats.admin} color="text-danger" />
          <StatCard label="Suspensos" value={stats.suspended} color="text-warning" />
        </div>

        {/* Busca */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-sm">🔍</span>
          <input
            type="text"
            placeholder="Buscar por nome ou email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-main outline-none focus:border-primary"
          />
        </div>

        {/* Erro */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Lista de usuários */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-text-secondary text-sm">
              {search ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Cabeçalho */}
              <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-2.5 bg-bg">
                <div />
                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Usuário</span>
                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide text-center w-16">Tarefas</span>
                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide text-center w-24">Plano</span>
                <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide text-right w-28">Ações</span>
              </div>

              {filtered.map((user) => {
                const isSelf = user.id === profile.id;
                const loadingRole = actionLoading === user.id + "_role";
                const loadingSuspend = actionLoading === user.id + "_suspend";
                return (
                  <div
                    key={user.id}
                    className={[
                      "flex flex-col md:grid md:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 md:gap-4 px-4 py-3 transition-colors",
                      user.suspended_at ? "bg-warning/5" : "hover:bg-bg/50",
                    ].join(" ")}
                  >
                    {/* Avatar */}
                    <Avatar name={user.full_name} url={user.avatar_url} size={9} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text-main truncate">
                          {user.full_name ?? "Sem nome"}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">VOCÊ</span>
                        )}
                        {user.suspended_at && (
                          <span className="text-[9px] font-bold bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">SUSPENSO</span>
                        )}
                      </div>
                      <p className="text-xs text-text-secondary truncate">{user.email}</p>
                      <p className="text-[10px] text-text-secondary/70 mt-0.5 md:hidden">
                        Desde {fmtDate(user.created_at)}
                      </p>
                    </div>

                    {/* Tarefas ativas */}
                    <div className="hidden md:flex flex-col items-center w-16">
                      <span className="text-sm font-semibold text-text-main">{user.task_count}</span>
                      <span className="text-[10px] text-text-secondary">ativas</span>
                    </div>

                    {/* Plano + alterar */}
                    <div className="flex items-center gap-2 w-full md:w-24 justify-between md:justify-center">
                      <RoleBadge role={user.role} />
                      {!isSelf && (
                        <select
                          value={user.role}
                          onChange={(e) => setRole(user.id, e.target.value)}
                          disabled={loadingRole}
                          className="text-xs bg-bg border border-border rounded-lg px-1.5 py-1 outline-none focus:border-primary text-text-main cursor-pointer"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </div>

                    {/* Suspender */}
                    <div className="flex items-center gap-2 w-full md:w-28 justify-end">
                      <span className="hidden md:block text-[10px] text-text-secondary">
                        {fmtDate(user.created_at)}
                      </span>
                      {!isSelf && (
                        <button
                          onClick={() => toggleSuspend(user)}
                          disabled={loadingSuspend}
                          className={[
                            "text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium whitespace-nowrap",
                            user.suspended_at
                              ? "border-success/40 text-success hover:bg-success/10"
                              : "border-warning/40 text-warning hover:bg-warning/10",
                          ].join(" ")}
                        >
                          {loadingSuspend ? "…" : user.suspended_at ? "Reativar" : "Suspender"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-text-secondary text-center">
          {filtered.length} de {users.length} usuário{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Modal de confirmação de suspensão */}
      {confirmSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmSuspend(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-semibold text-text-main mb-2">Suspender conta?</h3>
            <p className="text-sm text-text-secondary mb-5">
              A conta de <strong>{confirmSuspend.full_name ?? confirmSuspend.email}</strong> será suspensa.
              O usuário não poderá acessar o app até ser reativado.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSuspend(null)}
                className="flex-1 text-sm py-2 rounded-xl border border-border text-text-secondary hover:text-text-main transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => doSuspend(confirmSuspend.id, true)}
                className="flex-1 text-sm py-2 rounded-xl bg-warning text-white font-medium hover:opacity-90 transition-opacity"
              >
                Suspender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
