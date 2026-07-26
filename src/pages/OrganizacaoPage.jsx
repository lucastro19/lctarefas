import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useOrgStore, ROLE_LABELS, DEMAND_COLORS } from "../store/orgStore";
import { useCollaboratorStore } from "../store/collaboratorStore";
import { usePlanLimits } from "../hooks/usePlanLimits";
import { CollaboratorModal } from "../components/delegation/CollaboratorModal";
import { memberDisplayName } from "../components/delegation/shared";

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

const memberName = (m) => m?.profile?.full_name ?? m?.profile?.email ?? "Usuário";

// ─── Sem organização: sua equipe de contatos locais (Fase 1), sempre disponível ───
function TeamSection() {
  const { collaborators } = useCollaboratorStore();
  const { canAddCollaborator } = usePlanLimits();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-main">Sua equipe</h3>
          {canAddCollaborator && (
            <button onClick={() => setShowNew(true)} className="text-xs font-medium text-primary hover:underline">
              + Nova pessoa
            </button>
          )}
        </div>
        {collaborators.length === 0 ? (
          <p className="text-xs text-text-secondary">Nenhuma pessoa cadastrada ainda — cadastre contatos para delegar tarefas.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {collaborators.map((c) => (
              <button
                key={c.id}
                onClick={() => setEditing(c)}
                className="w-full flex items-center gap-3 py-2 text-left"
              >
                <Avatar name={c.name} url={c.avatar_url} />
                <span className="flex-1 text-sm text-text-main truncate">{c.name}</span>
                <span className="text-xs text-text-secondary shrink-0">Editar</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showNew && <CollaboratorModal onClose={() => setShowNew(false)} />}
      {editing && <CollaboratorModal collaborator={editing} onClose={() => setEditing(null)} />}
    </div>
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

// ─── Aba: Membros + convites ───
function MembersTab({ isOwner }) {
  const { user } = useAuthStore();
  const {
    members, invites, inviteMember, revokeInvite, inviteLink, fetchInvites,
    updateMemberRole, updateMemberManager, archiveMember, unarchiveMember, fetchArchivedMembers,
  } = useOrgStore();
  const { collaborators, archiveCollaborator, unarchiveCollaborator, fetchArchivedCollaborators } = useCollaboratorStore();
  const [archivedCollaborators, setArchivedCollaborators] = useState([]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("membro");
  const [managerId, setManagerId] = useState("");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const [showNewLocal, setShowNewLocal] = useState(false);
  const [editingLocal, setEditingLocal] = useState(null);
  const [prefillFor, setPrefillFor] = useState(null); // membro sem contato local, "adotando" um
  const [editingMemberContact, setEditingMemberContact] = useState(null); // membro COM contato local
  const [archivedMembers, setArchivedMembers] = useState([]);

  // Nome/telefone editáveis de um membro sem tocar na conta Google: usa o contato local (próprio
  // do viewer) vinculado a ele, se existir — ver memberDisplayName em delegation/shared.jsx.
  const displayName = (m) => memberDisplayName(m, collaborators);

  useEffect(() => { if (isOwner) fetchInvites(); }, [isOwner]);
  useEffect(() => { if (isOwner) fetchArchivedMembers().then(setArchivedMembers); }, [isOwner, members]);
  useEffect(() => { fetchArchivedCollaborators().then(setArchivedCollaborators); }, [collaborators]);

  const hasLocalContact = (m) => collaborators.some((c) => c.linked_user_id === m.user_id);
  const localOnly = collaborators.filter((c) => !c.linked_user_id);

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

  return (
    <div className="space-y-6">
      {/* Lista de membros */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Membros</h3>
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {members.map((m) => {
            const isSelf = m.user_id === user?.id;
            const canManage = isOwner && !isSelf;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={displayName(m)} url={m.profile?.avatar_url} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-main truncate">
                    {displayName(m)}
                    {isSelf && (
                      <span className="ml-2 text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">VOCÊ</span>
                    )}
                  </p>
                  {m.profile?.email && <p className="text-xs text-text-secondary truncate">{m.profile.email}</p>}
                </div>

                {canManage ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={m.role}
                      onChange={(e) => updateMemberRole(m.id, e.target.value)}
                      className="text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
                    >
                      <option value="estrategico">Estratégico</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="membro">Membro</option>
                    </select>
                    <select
                      value={m.manager_id ?? ""}
                      onChange={(e) => updateMemberManager(m.id, e.target.value)}
                      title="Reporta a"
                      className="text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main max-w-[130px]"
                    >
                      <option value="">Sem gestor</option>
                      {possibleManagers
                        .filter((pm) => pm.id !== m.id)
                        .map((pm) => (
                          <option key={pm.id} value={pm.id}>↳ {memberName(pm)}</option>
                        ))}
                    </select>
                    <button
                      onClick={() => { if (confirm(`Desativar ${memberName(m)}? Ela perde acesso à organização, mas o histórico de tarefas é preservado — dá pra reativar depois.`)) archiveMember(m.id); }}
                      className="text-xs text-danger hover:underline shrink-0"
                    >
                      Desativar
                    </button>
                  </div>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {hasLocalContact(m) ? (
                  <button
                    onClick={() => setEditingMemberContact(collaborators.find((c) => c.linked_user_id === m.user_id))}
                    title="Edita nome de exibição, telefone etc. do seu contato local vinculado a esta pessoa — não mexe na conta Google dela"
                    className="text-[10px] font-medium text-text-secondary hover:text-primary shrink-0"
                  >
                    Editar
                  </button>
                ) : (
                  <button
                    onClick={() => setPrefillFor(m)}
                    title="Ninguém em Colaboradores locais está vinculado a esta pessoa — sem contato local, ela não aparece pra delegar tarefas"
                    className="text-[10px] font-medium text-primary hover:underline shrink-0"
                  >
                    + Criar contato
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {isOwner && archivedMembers.length > 0 && (
          <details className="text-sm">
            <summary className="text-xs font-bold uppercase tracking-widest text-text-secondary cursor-pointer">
              Membros inativos ({archivedMembers.length})
            </summary>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden mt-2">
              {archivedMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={displayName(m)} url={m.profile?.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary truncate line-through">{displayName(m)}</p>
                    {m.profile?.email && <p className="text-xs text-text-secondary truncate">{m.profile.email}</p>}
                  </div>
                  <button
                    onClick={() => unarchiveMember(m.id)}
                    className="text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Colaboradores locais — contatos sem conta, usados pra delegar (Fase 1) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Colaboradores locais</h3>
          <button onClick={() => setShowNewLocal(true)} className="text-xs font-medium text-primary hover:underline">
            + Nova pessoa
          </button>
        </div>
        {localOnly.length === 0 ? (
          <p className="text-xs text-text-secondary">Nenhum contato só local no momento.</p>
        ) : (
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {localOnly.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-bg transition-colors">
                <button onClick={() => setEditingLocal(c)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <Avatar name={c.name} url={c.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-main truncate">{c.name}</p>
                    {c.email && <p className="text-xs text-text-secondary truncate">{c.email}</p>}
                  </div>
                </button>
                <button onClick={() => setEditingLocal(c)} className="text-xs text-text-secondary hover:text-primary shrink-0">Editar</button>
                <button onClick={() => archiveCollaborator(c.id)} className="text-xs text-text-secondary hover:text-danger shrink-0">Arquivar</button>
              </div>
            ))}
          </div>
        )}
        {archivedCollaborators.length > 0 && (
          <details className="text-sm">
            <summary className="text-xs font-bold uppercase tracking-widest text-text-secondary cursor-pointer">
              Colaboradores arquivados ({archivedCollaborators.length})
            </summary>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden mt-2">
              {archivedCollaborators.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={c.name} url={c.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-secondary truncate line-through">{c.name}</p>
                    {c.email && <p className="text-xs text-text-secondary truncate">{c.email}</p>}
                  </div>
                  <button
                    onClick={() => unarchiveCollaborator(c.id).then(() => fetchArchivedCollaborators().then(setArchivedCollaborators))}
                    className="text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
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

      {showNewLocal && <CollaboratorModal onClose={() => setShowNewLocal(false)} />}
      {editingLocal && <CollaboratorModal collaborator={editingLocal} onClose={() => setEditingLocal(null)} />}
      {editingMemberContact && (
        <CollaboratorModal collaborator={editingMemberContact} onClose={() => setEditingMemberContact(null)} />
      )}
      {prefillFor && (
        <CollaboratorModal
          prefill={{ name: memberName(prefillFor), email: prefillFor.profile?.email ?? "", linkedUserId: prefillFor.user_id }}
          onClose={() => setPrefillFor(null)}
        />
      )}
    </div>
  );
}

// ─── Aba: Times ───
function TeamCard({ team, members }) {
  const { renameTeam, setTeamLead, archiveTeam, addTeamMember, removeTeamMember } = useOrgStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [addId, setAddId] = useState("");

  const memberIds = new Set((team.team_members ?? []).map((tm) => tm.org_member_id));
  const teamMembers = members.filter((m) => memberIds.has(m.id));
  const available = members.filter((m) => !memberIds.has(m.id));

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== team.name) renameTeam(team.id, name); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setName(team.name); setEditing(false); } }}
            className="flex-1 text-sm font-semibold bg-bg border border-primary rounded-lg px-2 py-1 outline-none text-text-main"
          />
        ) : (
          <h4 className="flex-1 text-sm font-semibold text-text-main truncate">{team.name}</h4>
        )}
        <button onClick={() => setEditing((v) => !v)} className="text-[11px] text-text-secondary hover:text-primary">✎</button>
        <button
          onClick={() => { if (confirm(`Desativar o time "${team.name}"? Dá pra reativar depois.`)) archiveTeam(team.id); }}
          className="text-[11px] text-text-secondary hover:text-danger"
          title="Desativar time"
        >
          ⏸
        </button>
      </div>

      {/* Líder */}
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="shrink-0">Líder:</span>
        <select
          value={team.lead_id ?? ""}
          onChange={(e) => setTeamLead(team.id, e.target.value)}
          className="flex-1 text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
        >
          <option value="">Sem líder</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{memberName(m)}</option>
          ))}
        </select>
      </label>

      {/* Membros do time */}
      <div className="flex flex-wrap gap-1.5">
        {teamMembers.length === 0 && <span className="text-[11px] text-text-secondary">Nenhum membro ainda.</span>}
        {teamMembers.map((m) => (
          <span key={m.id} className="flex items-center gap-1 text-[11px] bg-bg border border-border rounded-full pl-2 pr-1 py-0.5">
            {memberName(m)}
            <button onClick={() => removeTeamMember(team.id, m.id)} className="text-text-secondary hover:text-danger px-0.5">×</button>
          </span>
        ))}
      </div>

      {available.length > 0 && (
        <div className="flex gap-2">
          <select
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            className="flex-1 text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
          >
            <option value="">Adicionar membro…</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>{memberName(m)}</option>
            ))}
          </select>
          <button
            onClick={() => { if (addId) { addTeamMember(team.id, addId); setAddId(""); } }}
            disabled={!addId}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

function TeamsTab() {
  const { teams, members, createTeam, fetchArchivedTeams, unarchiveTeam } = useOrgStore();
  const [newName, setNewName] = useState("");
  const [archivedTeams, setArchivedTeams] = useState([]);

  useEffect(() => { fetchArchivedTeams().then(setArchivedTeams); }, [teams]);

  const submit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createTeam(newName);
    setNewName("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do novo time (ex.: Comercial)"
          className="flex-1 text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
        >
          Criar time
        </button>
      </form>

      {teams.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-8">Nenhum time ainda. Crie o primeiro acima.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => <TeamCard key={t.id} team={t} members={members} />)}
        </div>
      )}

      {archivedTeams.length > 0 && (
        <details className="text-sm">
          <summary className="text-xs font-bold uppercase tracking-widest text-text-secondary cursor-pointer">
            Times inativos ({archivedTeams.length})
          </summary>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden mt-2">
            {archivedTeams.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm text-text-secondary truncate line-through">{t.name}</span>
                <button onClick={() => unarchiveTeam(t.id)} className="text-xs font-medium text-primary hover:underline shrink-0">
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Aba: Tipos de demanda ───
// Prazo padrão é gravado sempre em HORAS (coluna default_deadline_hours), mas exibido em dias por
// padrão (mais intuitivo), caindo pra horas quando o valor não é múltiplo exato de 24.
function hoursToDisplay(h) {
  if (h == null || h === "") return { amount: "", unit: "dias" };
  if (h % 24 === 0) return { amount: String(h / 24), unit: "dias" };
  return { amount: String(h), unit: "horas" };
}
function displayToHours(amount, unit) {
  if (amount === "" || amount == null) return null;
  const n = Number(amount);
  if (Number.isNaN(n)) return null;
  return unit === "dias" ? n * 24 : n;
}

function DeadlineInput({ amount, unit, onAmount, onUnit, disabled, size = "sm" }) {
  const wide = size === "lg";
  return (
    <div className="flex items-center gap-1 shrink-0">
      <input
        type="number"
        min={1}
        value={amount}
        disabled={disabled}
        onChange={(e) => onAmount(e.target.value)}
        placeholder="prazo"
        title="Prazo padrão"
        className={[wide ? "w-16 text-sm py-2.5" : "w-14 text-xs py-1", "bg-bg border border-border rounded-lg px-2 outline-none focus:border-primary text-text-main text-center"].join(" ")}
      />
      <select
        value={unit}
        disabled={disabled}
        onChange={(e) => onUnit(e.target.value)}
        title="Unidade do prazo"
        className={[wide ? "text-sm py-2.5" : "text-xs py-1", "bg-bg border border-border rounded-lg px-1.5 outline-none focus:border-primary text-text-secondary"].join(" ")}
      >
        <option value="dias">dias</option>
        <option value="horas">horas</option>
      </select>
    </div>
  );
}

function DemandTypeRow({ dt }) {
  const { updateDemandType, archiveDemandType, unarchiveDemandType } = useOrgStore();
  const [label, setLabel] = useState(dt.label);
  const initial = hoursToDisplay(dt.default_deadline_hours);
  const [amount, setAmount] = useState(initial.amount);
  const [unit, setUnit] = useState(initial.unit);
  const isArchived = !!dt.archived_at;

  const commitDeadline = (nextAmount, nextUnit) => {
    const hours = displayToHours(nextAmount, nextUnit);
    if (hours !== (dt.default_deadline_hours ?? null)) updateDemandType(dt.id, { default_deadline_hours: hours });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="flex gap-1.5 shrink-0">
        {DEMAND_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => !isArchived && updateDemandType(dt.id, { color: c })}
            disabled={isArchived}
            className={["w-4 h-4 rounded-full transition-transform", dt.color === c ? "ring-2 ring-offset-1 ring-offset-card ring-text-main scale-110" : "", isArchived ? "opacity-40" : ""].join(" ")}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <input
        value={label}
        disabled={isArchived}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label !== dt.label) updateDemandType(dt.id, { label: label.trim() }); }}
        className={["flex-1 text-sm bg-transparent outline-none text-text-main min-w-0", isArchived ? "line-through text-text-secondary" : ""].join(" ")}
      />
      <DeadlineInput
        amount={amount}
        unit={unit}
        disabled={isArchived}
        onAmount={(v) => { setAmount(v); commitDeadline(v, unit); }}
        onUnit={(u) => { setUnit(u); commitDeadline(amount, u); }}
      />
      {isArchived ? (
        <button onClick={() => unarchiveDemandType(dt.id)} className="text-[11px] text-primary hover:underline shrink-0">Reativar</button>
      ) : (
        <button onClick={() => archiveDemandType(dt.id)} className="text-[11px] text-text-secondary hover:text-danger shrink-0">Arquivar</button>
      )}
    </div>
  );
}

function DemandTypesTab() {
  const { demandTypes, createDemandType } = useOrgStore();
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(DEMAND_COLORS[0]);
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("dias");

  const active = demandTypes.filter((d) => !d.archived_at);
  const archived = demandTypes.filter((d) => d.archived_at);

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    await createDemandType({
      label, color,
      default_deadline_hours: displayToHours(amount, unit),
    });
    setLabel("");
    setColor(DEMAND_COLORS[0]);
    setAmount("");
    setUnit("dias");
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Taxonomia compartilhada entre tarefas e atendimentos. Ex.: Suporte, Vendas, Financeiro.
      </p>

      <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {DEMAND_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={["w-5 h-5 rounded-full transition-transform", color === c ? "ring-2 ring-offset-2 ring-offset-card ring-text-main scale-110" : ""].join(" ")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome do tipo de demanda"
            className="flex-1 min-w-[160px] text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
          />
          <DeadlineInput amount={amount} unit={unit} onAmount={setAmount} onUnit={setUnit} size="lg" />
          <button
            type="submit"
            disabled={!label.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
          >
            Criar
          </button>
        </div>
      </form>

      {active.length > 0 && (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {active.map((dt) => <DemandTypeRow key={dt.id} dt={dt} />)}
        </div>
      )}

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="text-xs font-bold uppercase tracking-widest text-text-secondary cursor-pointer">
            Arquivados ({archived.length})
          </summary>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden mt-2">
            {archived.map((dt) => <DemandTypeRow key={dt.id} dt={dt} />)}
          </div>
        </details>
      )}

      {demandTypes.length === 0 && (
        <p className="text-sm text-text-secondary text-center py-8">Nenhum tipo de demanda ainda.</p>
      )}
    </div>
  );
}

// ─── Aba: Configurações (gamificação/alertas) ───
const ROTATING_CATEGORIES = [
  { key: "mais_atendimentos", label: "Mais atendimentos" },
  { key: "melhor_csat",       label: "Melhor CSAT" },
  { key: "mais_pontual",      label: "Mais pontual" },
  { key: "maior_evolucao",    label: "Maior evolução do mês" },
];

function SettingsTab() {
  const { organization, updateOrgSettings } = useOrgStore();
  const settings = organization?.settings ?? {};
  const overload = settings.overloadThreshold ?? 8;
  const categories = settings.rotatingCategories ?? {};

  return (
    <div className="space-y-5">
      <div className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3">
        <p className="text-xs text-warning">
          ⚠️ Estes ajustes ficam guardados, mas só terão efeito quando os painéis de Carga
          (Fase 2.7) e Gamificação (Fase 2.9) forem construídos.
        </p>
      </div>

      {/* Alerta de sobrecarga */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-main">Alerta de sobrecarga</h3>
        <p className="text-xs text-text-secondary">
          Avisar quando uma pessoa acumular mais do que este número de tarefas ativas.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={overload}
            onChange={(e) => updateOrgSettings({ overloadThreshold: Number(e.target.value) || 1 })}
            className="w-20 text-sm bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-primary text-text-main text-center"
          />
          <span className="text-xs text-text-secondary">tarefas ativas por pessoa</span>
        </div>
      </section>

      {/* Categorias rotativas */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-main">Categorias rotativas (reconhecimento)</h3>
        <p className="text-xs text-text-secondary">
          Quais categorias aparecem no painel público. Rotativas de propósito — sem um “top 1” fixo.
        </p>
        <div className="space-y-1.5">
          {ROTATING_CATEGORIES.map((cat) => {
            const on = categories[cat.key] ?? true;
            return (
              <label key={cat.key} className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm text-text-main">{cat.label}</span>
                <button
                  type="button"
                  onClick={() => updateOrgSettings({ rotatingCategories: { ...categories, [cat.key]: !on } })}
                  className={["w-11 h-6 rounded-full transition-colors relative shrink-0", on ? "bg-success" : "bg-[#C7C7CC]"].join(" ")}
                >
                  <span className={["absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5"].join(" ")} />
                </button>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Com organização: cabeçalho + abas ───
// ─── Aba: Espaços (Fase 2) — contêiner compartilhado real da organização ───
function SpaceCard({ space, members }) {
  const { renameSpace, setSpaceColor, setSpaceOpen, archiveSpace, addSpaceMember, removeSpaceMember } = useOrgStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space.name);
  const [addId, setAddId] = useState("");

  const memberIds = new Set((space.space_members ?? []).map((sm) => sm.org_member_id));
  const spaceMembers = members.filter((m) => memberIds.has(m.id));
  const available = members.filter((m) => !memberIds.has(m.id));

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== space.name) renameSpace(space.id, name); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setName(space.name); setEditing(false); } }}
            className="flex-1 text-sm font-semibold bg-bg border border-primary rounded-lg px-2 py-1 outline-none text-text-main"
          />
        ) : (
          <h4 className="flex-1 text-sm font-semibold text-text-main truncate flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: space.color }} />
            {space.name}
          </h4>
        )}
        <button onClick={() => setEditing((v) => !v)} className="text-[11px] text-text-secondary hover:text-primary">✎</button>
        <button
          onClick={() => { if (confirm(`Desativar o espaço "${space.name}"? Dá pra reativar depois.`)) archiveSpace(space.id); }}
          className="text-[11px] text-text-secondary hover:text-danger"
          title="Desativar espaço"
        >
          ⏸
        </button>
      </div>

      <div className="flex gap-1.5">
        {DEMAND_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSpaceColor(space.id, c)}
            className={["w-4 h-4 rounded-full transition-transform", space.color === c ? "ring-2 ring-offset-1 ring-offset-card ring-text-main scale-110" : ""].join(" ")}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
        <span>{space.is_open ? "Aberto — toda a organização vê" : "Fechado — só os membros abaixo"}</span>
        <button
          type="button"
          onClick={() => setSpaceOpen(space.id, !space.is_open)}
          className={[
            "text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 transition-colors",
            space.is_open ? "bg-primary/10 text-primary" : "bg-border/60 text-text-secondary",
          ].join(" ")}
        >
          {space.is_open ? "Aberto" : "Fechado"}
        </button>
      </label>

      {!space.is_open && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {spaceMembers.length === 0 && <span className="text-[11px] text-text-secondary">Ninguém tem acesso ainda (além de você).</span>}
            {spaceMembers.map((m) => (
              <span key={m.id} className="flex items-center gap-1 text-[11px] bg-bg border border-border rounded-full pl-2 pr-1 py-0.5">
                {memberName(m)}
                <button onClick={() => removeSpaceMember(space.id, m.id)} className="text-text-secondary hover:text-danger px-0.5">×</button>
              </span>
            ))}
          </div>
          {available.length > 0 && (
            <div className="flex gap-2">
              <select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className="flex-1 text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
              >
                <option value="">Dar acesso a…</option>
                {available.map((m) => (
                  <option key={m.id} value={m.id}>{memberName(m)}</option>
                ))}
              </select>
              <button
                onClick={() => { if (addId) { addSpaceMember(space.id, addId); setAddId(""); } }}
                disabled={!addId}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
              >
                Adicionar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SpacesTab() {
  const { spaces, members, createSpace, fetchArchivedSpaces, unarchiveSpace } = useOrgStore();
  const [newName, setNewName] = useState("");
  const [archivedSpaces, setArchivedSpaces] = useState([]);

  useEffect(() => { fetchArchivedSpaces().then(setArchivedSpaces); }, [spaces]);

  const submit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createSpace({ name: newName });
    setNewName("");
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Um espaço é onde o trabalho da organização vive de verdade — diferente da sua área
        pessoal, todo mundo com acesso vê as tarefas dentro dele. Novo espaço nasce aberto
        (toda a organização vê); feche pra restringir a membros específicos.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do novo espaço (ex.: Suporte)"
          className="flex-1 text-sm bg-bg border border-border rounded-xl px-3 py-2.5 outline-none focus:border-primary text-text-main"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
        >
          Criar espaço
        </button>
      </form>

      {spaces.length === 0 ? (
        <p className="text-sm text-text-secondary text-center py-8">Nenhum espaço ainda. Crie o primeiro acima.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {spaces.map((s) => <SpaceCard key={s.id} space={s} members={members} />)}
        </div>
      )}

      {archivedSpaces.length > 0 && (
        <details className="text-sm">
          <summary className="text-xs font-bold uppercase tracking-widest text-text-secondary cursor-pointer">
            Espaços inativos ({archivedSpaces.length})
          </summary>
          <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden mt-2">
            {archivedSpaces.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="flex-1 text-sm text-text-secondary truncate line-through">{s.name}</span>
                <button onClick={() => unarchiveSpace(s.id)} className="text-xs font-medium text-primary hover:underline shrink-0">
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const OWNER_TABS = [
  { id: "membros",  label: "Membros" },
  { id: "espacos",  label: "Espaços" },
  { id: "times",    label: "Times" },
  { id: "demandas", label: "Tipos de demanda" },
  { id: "config",   label: "Configurações" },
];

function ManageOrg() {
  const { user } = useAuthStore();
  const { organization, members } = useOrgStore();
  const isOwner = organization?.owner_id === user?.id;
  const [tab, setTab] = useState("membros");

  const tabs = isOwner ? OWNER_TABS : OWNER_TABS.filter((t) => t.id === "membros");

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

      {/* Abas */}
      {tabs.length > 1 && (
        <div className="flex gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "text-sm px-3 py-2 border-b-2 -mb-px transition-colors",
                tab === t.id ? "border-primary text-text-main font-medium" : "border-transparent text-text-secondary hover:text-text-main",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "membros"  && <MembersTab isOwner={isOwner} />}
      {tab === "espacos"  && isOwner && <SpacesTab />}
      {tab === "times"    && isOwner && <TeamsTab />}
      {tab === "demandas" && isOwner && <DemandTypesTab />}
      {tab === "config"   && isOwner && <SettingsTab />}
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
        <>
          <TeamSection />
          <CreateOrgForm />
        </>
      )}
    </div>
  );
}
