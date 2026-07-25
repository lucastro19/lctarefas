import { useEffect, useState } from "react";
import { useDevIdeasStore } from "../../store/devIdeasStore";
import { WhatsNewModal } from "../settings/WhatsNewModal";

const QA_ROTEIRO_URL = "https://claude.ai/code/artifact/ab971b6e-1b2c-4388-bd8a-804c0d54fffa";

const STATUS_META = {
  ideia:        { label: "Ideia",        icon: "💡", color: "#8E8E93" },
  pesquisando:  { label: "Pesquisando",  icon: "🔍", color: "#4F8EF7" },
  planejado:    { label: "Planejado",    icon: "🗂️", color: "#FF9500" },
  em_andamento: { label: "Em andamento", icon: "🔧", color: "#AF52DE" },
  feito:        { label: "Feito",        icon: "✅", color: "#34C759" },
  descartado:   { label: "Descartado",   icon: "🗑️", color: "#8E8E93" },
};
const STATUS_ORDER = ["ideia", "pesquisando", "planejado", "em_andamento", "feito", "descartado"];

const SOURCE_META = {
  lucas:    { label: "Lucas",    color: "#4F8EF7" },
  pesquisa: { label: "Pesquisa", color: "#AF52DE" },
  equipe:   { label: "Equipe",   color: "#34C759" },
};

function IdeaCard({ idea, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(idea.description ?? "");
  const [timing, setTiming] = useState(idea.timing ?? "");
  const [notes, setNotes] = useState(idea.research_notes ?? "");
  const [shippedVersion, setShippedVersion] = useState(idea.shipped_version ?? "");

  const commit = (field, value, prev) => {
    if (value === (prev ?? "")) return;
    onUpdate(idea.id, { [field]: value || null });
  };

  const statusMeta = STATUS_META[idea.status] ?? STATUS_META.ideia;
  const sourceMeta = SOURCE_META[idea.source] ?? SOURCE_META.lucas;

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-text-main leading-snug flex-1">{idea.title}</p>
        <button
          onClick={() => { if (confirm(`Excluir a ideia "${idea.title}"?`)) onDelete(idea.id); }}
          className="text-text-secondary/50 hover:text-danger text-xs shrink-0"
          title="Excluir"
        >
          ✕
        </button>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => commit("description", description, idea.description)}
        placeholder="Descrição…"
        rows={2}
        className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-xs text-text-main outline-none focus:border-primary resize-none"
      />

      <div className="flex items-center gap-1.5 flex-wrap">
        <select
          value={idea.status}
          onChange={(e) => onUpdate(idea.id, { status: e.target.value })}
          className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 outline-none border-0 cursor-pointer"
          style={{ color: statusMeta.color, backgroundColor: statusMeta.color + "22" }}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].icon} {STATUS_META[s].label}</option>
          ))}
        </select>
        <select
          value={idea.source}
          onChange={(e) => onUpdate(idea.id, { source: e.target.value })}
          className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 outline-none border-0 cursor-pointer"
          style={{ color: sourceMeta.color, backgroundColor: sourceMeta.color + "22" }}
        >
          {Object.entries(SOURCE_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </div>

      <input
        value={timing}
        onChange={(e) => setTiming(e.target.value)}
        onBlur={() => commit("timing", timing, idea.timing)}
        placeholder="Melhor momento (ex: fazer já, esperar 2º módulo…)"
        className="w-full bg-bg border border-border rounded-lg px-2 py-1 text-[11px] text-text-main outline-none focus:border-primary"
      />

      {idea.status === "feito" && (
        <input
          value={shippedVersion}
          onChange={(e) => setShippedVersion(e.target.value)}
          onBlur={() => commit("shipped_version", shippedVersion, idea.shipped_version)}
          placeholder="Versão que entregou (ex: 1.1.0)"
          className="w-full bg-success/10 border border-success/30 rounded-lg px-2 py-1 text-[11px] text-success outline-none focus:border-success"
        />
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10.5px] text-text-secondary hover:text-text-main"
      >
        {expanded ? "▾ Ocultar pesquisa" : "▸ Notas de pesquisa"}
      </button>
      {expanded && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => commit("research_notes", notes, idea.research_notes)}
          placeholder="O que já pesquisamos sobre isso, referências de mercado…"
          rows={3}
          className="w-full bg-bg border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-main outline-none focus:border-primary resize-none"
        />
      )}
    </div>
  );
}

// Aba admin-only "Ideias & Roadmap" — backlog de ideias fora da memória de conversa, pra eu
// (Lucas) não esquecer nada e a Claude poder consultar/atualizar research_notes entre sessões.
export function DevIdeasBoard() {
  const { ideas, fetchIdeas, addIdea, updateIdea, deleteIdea } = useDevIdeasStore();
  const [quickTitle, setQuickTitle] = useState("");
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  const submitQuick = (e) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    addIdea(quickTitle);
    setQuickTitle("");
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={QA_ROTEIRO_URL}
          target="_blank"
          rel="noreferrer"
          className="bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-text-main hover:border-primary transition-colors flex items-center justify-between"
        >
          📋 Roteiro de QA <span className="text-text-secondary">→</span>
        </a>
        <button
          onClick={() => setShowWhatsNew(true)}
          className="bg-card border border-border rounded-xl px-4 py-3 text-sm font-medium text-text-main hover:border-primary transition-colors flex items-center justify-between"
        >
          🎉 Ver Novidades <span className="text-text-secondary">→</span>
        </button>
      </div>

      <form onSubmit={submitQuick} className="flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Nova ideia… Enter pra salvar"
          className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-text-main outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Adicionar
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {STATUS_ORDER.map((status) => {
          const items = ideas.filter((i) => i.status === status);
          const meta = STATUS_META[status];
          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <span>{meta.icon}</span>
                <span className="text-xs font-semibold text-text-main">{meta.label}</span>
                <span className="text-[10px] text-text-secondary">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-8">
                {items.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onUpdate={updateIdea} onDelete={deleteIdea} />
                ))}
                {items.length === 0 && (
                  <p className="text-[11px] text-text-secondary/60 px-1">Nada aqui.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showWhatsNew && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
    </div>
  );
}
