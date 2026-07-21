import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useCollaboratorStore, COLLABORATOR_COLORS } from "../../store/collaboratorStore";

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

export function CollaboratorModal({ collaborator = null, onClose }) {
  const { createCollaborator, updateCollaborator } = useCollaboratorStore();
  const editing = !!collaborator;

  const [name,  setName]  = useState(collaborator?.name ?? "");
  const [role,  setRole]  = useState(collaborator?.role ?? "");
  const [email, setEmail] = useState(collaborator?.email ?? "");
  const [phone, setPhone] = useState(maskPhone(collaborator?.phone ?? ""));
  const [color, setColor] = useState(collaborator?.color ?? COLLABORATOR_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const fields = {
      name: name.trim(),
      role: role.trim() || null,
      email: email.trim() || null,
      phone: phone.replace(/\D/g, "") || null,
      color,
    };
    if (editing) await updateCollaborator(collaborator.id, fields);
    else await createCollaborator(fields);
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
          {editing ? "Editar colaborador" : "Novo colaborador"}
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
        </div>
      </form>
    </div>,
    document.body
  );
}
