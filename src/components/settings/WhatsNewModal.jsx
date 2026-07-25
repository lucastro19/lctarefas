import { useEffect } from "react";
import { createPortal } from "react-dom";
import { RELEASE_NOTES, markReleaseSeen } from "../../data/releaseNotes";

const TYPE_META = {
  new: { icon: "✨", label: "Novo", color: "#4F8EF7" },
  improved: { icon: "🔧", label: "Melhorado", color: "#FF9500" },
  fixed: { icon: "🐛", label: "Corrigido", color: "#34C759" },
};

function fmtDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

// Novidades (What's new) — pedido do Lucas ao lado do versionamento formal (v1.0.0). Conteúdo
// vem de src/data/releaseNotes.js, a mesma informação do CHANGELOG.md em linguagem de usuário.
export function WhatsNewModal({ onClose }) {
  useEffect(() => { markReleaseSeen(); }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[82vh] flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 border-b border-border flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-text-main">🎉 Novidades</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-main text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {RELEASE_NOTES.map((r) => (
            <div key={r.version}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[13px] font-bold text-text-main">v{r.version}</span>
                <span className="text-[11px] text-text-secondary">{fmtDate(r.date)}</span>
              </div>
              <p className="text-[13px] font-medium text-text-main mb-2.5">{r.title}</p>
              <ul className="space-y-1.5">
                {r.highlights.map((h, i) => {
                  const meta = TYPE_META[h.type] ?? TYPE_META.new;
                  return (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] text-text-main leading-snug">
                      <span
                        className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                        style={{ backgroundColor: meta.color + "22" }}
                        title={meta.label}
                      >
                        {meta.icon}
                      </span>
                      <span className="flex-1">{h.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
