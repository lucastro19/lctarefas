import { useState, useRef, useEffect } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useAreaStore } from "../../store/areaStore";

function localDateStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function QuickEntry({ onClose }) {
  const [title, setTitle] = useState("");
  const [contextValue, setContextValue] = useState("");
  const [date, setDate] = useState("");
  const inputRef = useRef(null);

  const { createTask } = useTaskStore();
  const { areas, projects } = useAreaStore();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t) return;

    const fields = {};
    if (contextValue.startsWith("area:")) fields.area_id = contextValue.slice(5);
    else if (contextValue.startsWith("project:")) fields.project_id = contextValue.slice(8);
    if (date) fields.scheduled_date = date;

    await createTask({ title: t, ...fields });
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const todayDate = localDateStr();
  const isToday = date === todayDate;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
      <div
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs text-text-secondary/60 font-medium uppercase tracking-widest mb-2">Nova Tarefa</p>
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKey}
            placeholder="O que precisa ser feito?"
            className="w-full text-base font-medium text-text-main outline-none bg-transparent placeholder:text-text-secondary/40"
          />
        </div>

        <div className="flex items-center gap-2 px-4 pb-3 pt-1 border-t border-border mt-3">
          <button
            type="button"
            onClick={() => setDate(isToday ? "" : todayDate)}
            className={[
              "text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium shrink-0",
              isToday
                ? "bg-primary text-white border-primary"
                : "bg-bg border-border text-text-secondary hover:border-primary hover:text-primary",
            ].join(" ")}
          >
            Hoje
          </button>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-secondary"
          />

          <select
            value={contextValue}
            onChange={(e) => setContextValue(e.target.value)}
            className="flex-1 text-xs bg-bg border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary text-text-secondary"
          >
            <option value="">Inbox</option>
            {areas.map((area) => (
              <optgroup key={area.id} label={area.name}>
                <option value={`area:${area.id}`}>{area.name}</option>
                {projects.filter((p) => p.area_id === area.id).map((p) => (
                  <option key={p.id} value={`project:${p.id}`}>↳ {p.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors font-medium shrink-0"
          >
            Adicionar
          </button>
        </div>

        <p className="text-xs text-text-secondary/40 text-center pb-3">
          Enter para salvar · Esc para cancelar
        </p>
      </div>
    </div>
  );
}
