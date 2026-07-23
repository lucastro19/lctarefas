import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCollaboratorStore, COLLABORATOR_COLORS } from "../../store/collaboratorStore";
import { useOrgStore, ROLE_LABELS } from "../../store/orgStore";
import { useAuthStore } from "../../store/authStore";

// Máscara visual de telefone BR: (31) 99999-8888. No banco guardamos só dígitos.
function maskPhone(value) {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{label}</span>
      <input
        {...props}
        className="mt-1 w-full text-[14px] bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-primary text-text-main"
      />
    </label>
  );
}

export function CollaboratorModal({ collaborator = null, prefill = null, onClose }) {
  const { createCollaborator, updateCollaborator } = useCollaboratorStore();
  const { user } = useAuthStore();
  const {
    organization, members, invites, fetchInvites, inviteMember, revokeInvite, inviteLink,
  } = useOrgStore();
  const editing = !!collaborator;
  const isOwner = !!organization && organization.owner_id === user?.id;

  const [name,  setName]  = useState(collaborator?.name ?? prefill?.name ?? "");
  const [role,  setRole]  = useState(collaborator?.role ?? "");
  const [email, setEmail] = useState(collaborator?.email ?? prefill?.email ?? "");
  const [phone, setPhone] = useState(maskPhone(collaborator?.phone ?? ""));
  const [color, setColor] = useState(collaborator?.color ?? COLLABORATOR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  // Vínculo com a organização (Fase 2.3+): só o dono pode convidar.
  const [linkOrg, setLinkOrg] = useState(false);
  const [orgRole, setOrgRole] = useState("membro");
  const [managerId, setManagerId] = useState("");
  const [linkError, setLinkError] = useState("");
  const [lastLink, setLastLink] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (isOwner) fetchInvites(); }, [isOwner]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const alreadyLinked = !!collaborator?.linked_user_id;
  const pendingInvite = invites.find(
    (i) => i.status === "pending" && email.trim() && i.email.toLowerCase() === email.trim().toLowerCase()
  );
  const possibleManagers = members.filter((m) => m.role === "estrategico" || m.role === "supervisor");

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível — usuário copia manualmente */ }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setLinkError("");
    const fields = {
      name: name.trim(),
      role: role.trim() || null,
      email: email.trim() || null,
      phone: phone.replace(/\D/g, "") || null,
      color,
    };
    if (editing) await updateCollaborator(collaborator.id, fields);
    else await createCollaborator(fields);

    if (linkOrg && email.trim()) {
      const invite = await inviteMember({
        email: email.trim(),
        role: orgRole,
        managerId: orgRole === "membro" && managerId ? managerId : null,
      });
      setSaving(false);
      if (invite) {
        setLastLink(inviteLink(invite.token));
        setCopied(false);
        return; // mantém o modal aberto pra mostrar o link gerado
      }
      setLinkError("Não foi possível gerar o convite. Tente de novo editando esta pessoa.");
      return;
    }
    setSaving(false);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl p-5 w-full max-w-sm space-y-4"
      >
        <h2 className="text-[17px] font-semibold text-text-main">
          {editing ? "Editar pessoa" : "Nova pessoa"}
        </h2>

        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="João Silva" />
        <Field label="Cargo" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Analista comercial" />
        <Field
          label="WhatsApp"
          value={phone}
          onChange={(e) => setPhone(maskPhone(e.target.value))}
          inputMode="numeric"
          placeholder="(31) 99999-8888"
        />
        <p className="text-[11px] text-text-secondary -mt-2">
          Necessário para o botão de cobrança rápida.
        </p>
        <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@empresa.com" />

        {organization && isOwner && (
          <div>
            {alreadyLinked ? (
              <p className="text-[12px] text-success">✅ Vinculado à organização</p>
            ) : pendingInvite ? (
              <div className="bg-bg border border-border rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-text-secondary">
                  Convite pendente · {ROLE_LABELS[pendingInvite.role]}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => copyLink(inviteLink(pendingInvite.token))}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {copied ? "Copiado ✓" : "Copiar link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvite(pendingInvite.id)}
                    className="text-[11px] font-medium text-danger hover:underline"
                  >
                    Revogar
                  </button>
                </div>
              </div>
            ) : lastLink ? (
              <div className="bg-bg border border-border rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-text-secondary">
                  Convite gerado — envie manualmente (WhatsApp, e-mail).
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
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[13px] text-text-main">
                  <input
                    type="checkbox"
                    checked={linkOrg}
                    disabled={!email.trim()}
                    onChange={(e) => setLinkOrg(e.target.checked)}
                  />
                  Vincular à organização
                </label>
                {!email.trim() && (
                  <p className="text-[11px] text-text-secondary">Preencha o e-mail para poder convidar.</p>
                )}
                {linkOrg && (
                  <div className="space-y-2 pl-1">
                    <select
                      value={orgRole}
                      onChange={(e) => setOrgRole(e.target.value)}
                      className="w-full text-[13px] bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
                    >
                      <option value="membro">Membro</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                    {orgRole === "membro" && possibleManagers.length > 0 && (
                      <select
                        value={managerId}
                        onChange={(e) => setManagerId(e.target.value)}
                        className="w-full text-[13px] bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-main"
                      >
                        <option value="">Reporta a você</option>
                        {possibleManagers
                          .filter((m) => m.user_id !== user?.id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>Reporta a {m.profile?.full_name ?? m.profile?.email ?? "?"}</option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
                {linkError && <p className="text-[11px] text-danger">{linkError}</p>}
              </div>
            )}
          </div>
        )}

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Cor</span>
          <div className="flex gap-2 mt-2 flex-wrap">
            {COLLABORATOR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={[
                  "w-7 h-7 rounded-full transition-transform",
                  color === c ? "ring-2 ring-offset-2 ring-offset-card ring-text-main scale-110" : "hover:scale-105",
                ].join(" ")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {lastLink ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity"
            >
              Concluir
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm text-text-secondary hover:bg-bg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim() || saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
              </button>
            </>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}
