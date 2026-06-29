import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";
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

export function SearchModal({ onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const { tasks } = useTaskStore();
  const { areas, projects } = useAreaStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim().length < 1 ? [] : tasks
    .filter((t) => !t.deleted_at && (
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      (t.notes ?? "").toLowerCase().includes(query.toLowerCase())
    ))
    .slice(0, 8);

  useEffect(() => { setSelected(0); }, [query]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
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

        {results.length > 0 && (
          <div className="py-1 max-h-80 overflow-y-auto">
            {results.map((task, i) => (
              <button
                key={task.id}
                onClick={() => open(task)}
                className={["w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors", i === selected ? "bg-primary/10" : "hover:bg-bg"].join(" ")}
              >
                <span className="text-base shrink-0">{task.completed_at ? "✅" : task.archived_at ? "📦" : "☐"}</span>
                <div className="flex-1 min-w-0">
                  <p className={["text-sm truncate", task.completed_at ? "line-through text-text-secondary" : "text-text-main"].join(" ")}>
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

        {query.trim().length > 0 && results.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">Nenhum resultado para "{query}"</p>
        )}

        {query.trim().length === 0 && (
          <p className="text-xs text-text-secondary text-center py-6">Digite para buscar em todas as tarefas</p>
        )}
      </div>
    </div>
  );
}
