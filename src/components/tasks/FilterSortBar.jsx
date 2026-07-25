import { useState } from "react";

// Barra de filtro + agrupar + ordenar (Fase 4.4/4.5) — estilo chips que ligam/desligam (Linear).
// Só aparece o que faz sentido: chips de pessoa só quando há mais de 1 pessoa nas tarefas,
// "Agrupar" só é relevante no Board.
export function FilterSortBar({
  people, types,
  personFilter, setPersonFilter,
  typeFilter, setTypeFilter,
  lateOnly, setLateOnly,
  sortBy, setSortBy,
  groupBy, setGroupBy,
  showGroupBy = false,
  isMineActive, toggleMine,
  savedViews = [], saveCurrentView, applyView, deleteView,
}) {
  const [addingView, setAddingView] = useState(false);
  const [viewName, setViewName] = useState("");

  const toggle = (list, setList, id) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const chipClass = (active) => [
    "px-2.5 py-1 rounded-full border text-[11.5px] font-medium transition-colors shrink-0",
    active ? "border-primary/40 text-text-main bg-primary/8" : "border-border text-text-secondary/60",
  ].join(" ");

  const hasFilterableData = people.length > 1 || types.length > 0;

  const submitView = (e) => {
    e.preventDefault();
    if (!viewName.trim()) return;
    saveCurrentView(viewName);
    setViewName("");
    setAddingView(false);
  };

  return (
    <div className="mb-3 space-y-1.5">
      {(savedViews.length > 0 || hasFilterableData) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {savedViews.map((v) => (
            <button
              key={v.name}
              onClick={() => applyView(v)}
              onContextMenu={(e) => { e.preventDefault(); deleteView(v.name); }}
              title="Clique pra aplicar · botão direito pra apagar"
              className="px-2.5 py-1 rounded-full border border-warning/40 bg-warning/10 text-[11.5px] font-medium text-text-main shrink-0"
            >
              ⭐ {v.name}
            </button>
          ))}
          {hasFilterableData && (
            addingView ? (
              <form onSubmit={submitView} className="flex items-center gap-1 shrink-0">
                <input
                  autoFocus
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onBlur={() => { if (!viewName.trim()) setAddingView(false); }}
                  placeholder="Nome da view…"
                  className="text-[11.5px] bg-card border border-border rounded-full px-2.5 py-1 outline-none focus:border-primary w-28"
                />
              </form>
            ) : (
              <button
                onClick={() => setAddingView(true)}
                className="px-2.5 py-1 rounded-full border border-dashed border-border text-[11.5px] text-text-secondary/70 hover:text-text-secondary shrink-0"
              >
                + Salvar view atual
              </button>
            )
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {people.length > 1 && (
          <button onClick={toggleMine} className={chipClass(isMineActive)}>👤 Só minhas</button>
        )}
        {people.length > 1 && people.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(personFilter, setPersonFilter, p.id)}
            className={chipClass(personFilter.length === 0 || personFilter.includes(p.id))}
          >
            {p.label}
          </button>
        ))}
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => toggle(typeFilter, setTypeFilter, t.id)}
            className={[chipClass(typeFilter.length === 0 || typeFilter.includes(t.id)), "flex items-center gap-1"].join(" ")}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
            {t.label}
          </button>
        ))}
        <button onClick={() => setLateOnly((v) => !v)} className={chipClass(lateOnly)}>🚨 Atrasadas</button>

        {showGroupBy && (
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="text-[11.5px] bg-card border border-border rounded-full px-2.5 py-1 outline-none text-text-secondary"
          >
            <option value="status">Agrupar: Status</option>
            <option value="person">Agrupar: Pessoa</option>
            <option value="type">Agrupar: Tipo</option>
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-[11.5px] bg-card border border-border rounded-full px-2.5 py-1 outline-none text-text-secondary"
        >
          <option value="none">Ordenar: padrão</option>
          <option value="deadline">Ordenar: Prazo</option>
          <option value="priority">Ordenar: Prioridade</option>
          <option value="aging">Ordenar: Tempo parado</option>
        </select>
      </div>
    </div>
  );
}
