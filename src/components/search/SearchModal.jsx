import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";
import { useTagStore } from "../../store/tagStore";
import { useUiStore } from "../../store/uiStore";

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const PRIORITY_COLORS = { high: "#FF3B30", medium: "#FF9500", low: "#34C759" };

export function SearchModal({ onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all"); // all | pending | done | archived
  const [filterPriority, setFilterPriority] = useState(""); // "" | high | medium | low
  const [filterArea, setFilterArea] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const { tasks } = useTaskStore();
  const { areas, projects } = useAreaStore();
  const { tags, taskTags } = useTagStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const hasFilters = filterStatus !== "all" || filterPriority || filterArea;

  const results = (query.trim().length < 1 && !hasFilters) ? [] : tasks
    .filter((t) => {
      if (t.deleted_at) return false;
      // text search
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !(t.notes ?? "").toLowerCase().includes(q)) return false;
      }
      // status filter
      if (filterStatus === "pending" && (t.completed_at || t.archived_at)) return false;
      if (filterStatus === "done" && !t.completed_at) return false;
      if (filterStatus === "archived" && !t.archived_at) return false;
      // priority filter
      if (filterPriority && t.priority !== filterPriority) return false;
      // area filter
      if (filterArea && t.area_id !== filterArea && t.project_id !== filterArea) return false;
      return true;
    })
    .slice(0, 12);

  useEffect(() => { setSelected(0); }, [query, filterStatus, filterPriority, filterArea]);

  const getContext = (task) => {
    if (task.project_id) {
      const p = projects.find((p) => p.id === task.project_id);
      return p?.name ?? "";
    }
    if (task.area_id) {
      const a = areas.find((a) => a.id === task.area_id);
      return a?.name ?? "";
    }
    if (task.someday) return "Depois";
    if (task.scheduled_date) return "Hoje";
    return "Inbox";
  };

  const { openTask } = useUiStore();

  const open = (task) => {
    if (task.project_id) navigate(`/project/${task.project_id}`);
    else if (task.area_id) navigate(`/area/${task.area_id}`);
    else if (task.someday) navigate("/someday");
    else if (task.scheduled_date) navigate("/today");
    else navigate("/inbox");
    openTask(task);
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) open(results[selected]);
  };

  const Chip = ({ active, onClick, children, color }) => (
    <button
      onClick={onClick}
      className={[
        "text-[10px] px-2 py-0.5 rounded-full border transition-colors font-medium shrink-0",
        active
          ? "border-primary bg-primary text-white"
          : "border-border text-text-secondary hover:border-primary/40 hover:text-primary",
      ].join(" ")}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-text-secondary text-lg">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar tarefas…"
            className="flex-1 text-sm text-text-main outline-none bg-transparent placeholder:text-text-secondary"
          />
          <kbd className="text-xs text-text-secondary border border-[#C7C7CC] rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto scrollbar-none">
          <Chip active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>Todas</Chip>
          <Chip active={filterStatus === "pending"} onClick={() => setFilterStatus(filterStatus === "pending" ? "all" : "pending")}>Pendente</Chip>
          <Chip active={filterStatus === "done"} onClick={() => setFilterStatus(filterStatus === "done" ? "all" : "done")}>Concluída</Chip>
          <Chip active={filterStatus === "archived"} onClick={() => setFilterStatus(filterStatus === "archived" ? "all" : "archived")}>Arquivada</Chip>
          <span className="w-px h-3 bg-border shrink-0" />
          <Chip active={filterPriority === "high"} color={PRIORITY_COLORS.high} onClick={() => setFilterPriority(filterPriority === "high" ? "" : "high")}>🔴 Alta</Chip>
          <Chip active={filterPriority === "medium"} color={PRIORITY_COLORS.medium} onClick={() => setFilterPriority(filterPriority === "medium" ? "" : "medium")}>🟡 Média</Chip>
          <Chip active={filterPriority === "low"} color={PRIORITY_COLORS.low} onClick={() => setFilterPriority(filterPriority === "low" ? "" : "low")}>🟢 Baixa</Chip>
          {areas.length > 0 && (
            <>
              <span className="w-px h-3 bg-border shrink-0" />
              {areas.map((a) => (
                <Chip key={a.id} active={filterArea === a.id} onClick={() => setFilterArea(filterArea === a.id ? "" : a.id)}>
                  {a.name}
                </Chip>
              ))}
            </>
          )}
        </div>

        {results.length > 0 && (
          <div className="py-1 max-h-72 overflow-y-auto">
            {results.map((task, i) => (
              <button
                key={task.id}
                onClick={() => open(task)}
                className={["w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors", i === selected ? "bg-primary/10" : "hover:bg-bg"].join(" ")}
              >
                <span className="text-base shrink-0">{task.completed_at ? "✅" : task.archived_at ? "📦" : "☐"}</span>
                <div className="flex-1 min-w-0">
                  <p className={["text-sm truncate", task.completed_at ? "line-through text-text-secondary" : "text-text-main"].join(" ")}>
                    {task.priority && (
                      <span className="mr-1" style={{ color: PRIORITY_COLORS[task.priority] }}>⚑</span>
                    )}
                    {highlight(task.title, query)}
                  </p>
                  {task.notes && (
                    <p className="text-xs text-text-secondary truncate mt-0.5">{task.notes}</p>
                  )}
                </div>
                <span className="text-xs text-text-secondary shrink-0">{getContext(task)}</span>
              </button>
            ))}
          </div>
        )}

        {(query.trim().length > 0 || hasFilters) && results.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">Nenhum resultado encontrado</p>
        )}

        {query.trim().length === 0 && !hasFilters && (
          <p className="text-xs text-text-secondary text-center py-6">Digite para buscar · use os filtros para refinar</p>
        )}
      </div>
    </div>
  );
}
