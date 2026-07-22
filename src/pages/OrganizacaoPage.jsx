import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useOrgStore, ROLE_LABELS } from "../store/orgStore";

function Avatar({ name, url }) {
  if (url) return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  const initials = (name ?? "?").trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

const ROLE_BADGE = {
  estrategico: "text-danger bg-danger/10 border border-danger/20",
  supervisor:  "text-primary bg-primary/10 border border-primary/20",
  membro:      "text-text-secondary bg-border/60",
};

function RoleBadge({ role }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${ROLE_BADGE[role] ?? ROLE_BADGE.membro}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ─── Sem organização: formulário de criação ───
function CreateOrgForm() {
  const { createOrganization } = useOrgStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    await createOrganization(name);
    setSaving(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="space-y-1">
          <span className="text-3xl">🏛️</span>
          <h2 className="text-lg font-semibold text-text-main">Criar sua organização</h2>
          <p className="text-sm text-text-secondary">
            Você vira o gestor estratégico — no topo da hierarquia. Depois convida supervisores e
            membros. Suas tarefas pessoais continuam privadas.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Nome da empresa</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Ex.: LC Tecnologia"
              className="mt-1 w-full text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving ? "Criando…" : "Criar organização"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Com organização: membros + convite ───
function ManageOrg() {
  const { user } = useAuthStore();
  const { organization, members, invites, inviteMember, revokeInvite, inviteLink, fetchInvites } = useOrgStore();
  const isOwner = organization?.owner_id === user?.id;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("membro");
  const [managerId, setManagerId] = useState("");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (isOwner) fetchInvites(); }, [isOwner]);

  // Só estratégico/supervisor podem ser gestores de um membro
  const possibleManagers = useMemo(
    () => members.filter((m) => m.role === "estrategico" || m.role === "supervisor"),
    [members]
  );

  const pendingInvites = invites.filter((i) => i.status === "pending");

  const submitInvite = async (e) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    const invite = await inviteMember({
      email,
      role,
      managerId: role === "membro" && managerId ? managerId : null,
    });
    setSending(false);
    if (invite) {
      setLastLink(inviteLink(invite.token));
      setCopied(false);
      setEmail("");
      setManagerId("");
    }
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível — usuário copia manualmente */ }
  };

  const memberName = (m) => m.profile?.full_name ?? m.profile?.email ?? "Usuário";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Cabeçalho da org */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏛️</span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-main truncate">{organization.name}</h2>
          <p className="text-xs text-text-secondary">
            {members.length} membro{members.length !== 1 ? "s" : ""}
            {!isOwner && " · você é membro desta organização"}
          </p>
        </div>
      </div>

      {/* Membros */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Membros</h3>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={memberName(m)} url={m.profile?.avatar_url} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-main truncate">
                  {memberName(m)}
                  {m.user_id === user?.id && (
                    <span className="ml-2 text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">VOCÊ</span>
                  )}
                </p>
                {m.profile?.email && <p className="text-xs text-text-secondary truncate">{m.profile.email}</p>}
              </div>
              <RoleBadge role={m.role} />
            </div>
          ))}
        </div>
      </section>

      {/* Convidar — só o dono */}
      {isOwner && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Convidar</h3>
          <form onSubmit={submitInvite} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="flex-1 text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
              >
                <option value="membro">Membro</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>

            {role === "membro" && possibleManagers.length > 0 && (
              <label className="block">
                <span className="text-xs font-medium text-text-secondary">Reporta a</span>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="mt-1 w-full text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
                >
                  <option value="">Você (estratégico)</option>
                  {possibleManagers
                    .filter((m) => m.user_id !== user?.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>{memberName(m)}</option>
                    ))}
                </select>
              </label>
            )}

            <button
              type="submit"
              disabled={!email.trim() || sending}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {sending ? "Gerando convite…" : "Gerar link de convite"}
            </button>

            {lastLink && (
              <div className="bg-bg border border-border rounded-xl p-3 space-y-2">
                <p className="text-xs text-text-secondary">
                  Link gerado — envie manualmente para o convidado (WhatsApp, e-mail). Ele precisa
                  entrar com o mesmo e-mail do convite.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={lastLink}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 text-xs bg-card border border-border rounded-lg px-2 py-1.5 text-text-main outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(lastLink)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-white hover:opacity-90 transition-opacity shrink-0"
                  >
                    {copied ? "Copiado ✓" : "Copiar"}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Convites pendentes */}
          {pendingInvites.length > 0 && (
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-sm">✉️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-main truncate">{inv.email}</p>
                    <p className="text-[11px] text-text-secondary">Convite pendente · {ROLE_LABELS[inv.role]}</p>
                  </div>
                  <button
                    onClick={() => copyLink(inviteLink(inv.token))}
                    className="text-[11px] text-primary hover:underline shrink-0"
                  >
                    Copiar link
                  </button>
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="text-[11px] text-danger hover:underline shrink-0"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function OrganizacaoPage() {
  const navigate = useNavigate();
  const { organization, loaded, fetchOrganization } = useOrgStore();

  useEffect(() => { if (!loaded) fetchOrganization(); }, [loaded]);

  return (
    <div className="min-h-screen bg-bg">
      <div className="bg-card border-b border-border px-6 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate("/today")}
          className="text-sm text-text-secondary hover:text-text-main transition-colors"
        >
          ← Voltar
        </button>
        <div className="h-4 w-px bg-border" />
        <h1 className="text-base font-semibold text-text-main">Organização</h1>
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : organization ? (
        <ManageOrg />
      ) : (
        <CreateOrgForm />
      )}
    </div>
  );
}
