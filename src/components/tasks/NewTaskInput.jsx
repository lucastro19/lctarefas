import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskStore } from "../../store/taskStore";
import { useTemplateStore } from "../../store/templateStore";
import { parseNaturalDate, formatDateHint } from "../../utils/nlpDate";
import { usePlanLimits } from "../../hooks/usePlanLimits";

export function NewTaskInput({ defaultFields = {}, onCreated }) {
  const [value, setValue] = useState("");
  const [active, setActive] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { createTask } = useTaskStore();
  const { templates, deleteTemplate } = useTemplateStore();
  const { canAddTask, isPro, usage, limits } = usePlanLimits();
  const navigate = useNavigate();

  const nlp = useMemo(() => parseNaturalDate(value), [value]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = nlp ? nlp.cleanTitle || value.trim() : value.trim();
    if (!title) return;
    const extra = {};
    if (nlp?.dateStr) extra.scheduled_date = nlp.dateStr;
    if (nlp?.timeStr) extra.scheduled_time = nlp.timeStr;
    const created = await createTask({ title, ...defaultFields, ...extra });
    if (created) onCreated?.(created);
    setValue("");
  };

  const applyTemplate = (tpl) => {
    setValue(tpl.fields.title);
    setShowTemplates(false);
  };

  if (!canAddTask) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-card bg-warning/5 border border-warning/20">
        <span className="text-warning text-sm">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-warning font-medium">Limite de {limits.tasks} tarefas atingido</p>
          <p className="text-[10px] text-text-secondary">Conclua tarefas ou faça upgrade para Pro</p>
        </div>
        <button
          onClick={() => navigate("/settings-upgrade")}
          className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors whitespace-nowrap shrink-0"
        >
          Ver Pro
        </button>
      </div>
    );
  }

  if (!active) {
    const usagePct = Math.round((usage.tasks / limits.tasks) * 100);
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-main hover:bg-card rounded-card w-full transition-all dark:text-white/40 dark:hover:text-white/80"
      >
        <span className="w-5 h-5 rounded-full border-2 border-[#AEAEB2] dark:border-white/30 flex items-center justify-center text-[#AEAEB2] dark:text-white/30 text-xs font-bold leading-none">
          +
        </span>
        <span className="flex-1 text-left">Nova tarefa</span>
        {!isPro && usagePct >= 80 && (
          <span className="text-[10px] text-warning font-medium">{usage.tasks}/{limits.tasks}</span>
        )}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="bg-card border border-primary rounded-card shadow-sm px-4 py-3"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (!value.trim()) setActive(false); }}
        placeholder="Nova tarefa… (ex: Reunião amanhã às 14h)"
        className="w-full text-sm text-text-main outline-none bg-transparent placeholder:text-text-secondary dark:placeholder:text-white/30"
        onKeyDown={(e) => e.key === "Escape" && setActive(false)}
      />
      {nlp && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">
            📅 {formatDateHint(nlp.dateStr)}{nlp.timeStr ? ` às ${nlp.timeStr}` : ""}
          </span>
          <span className="text-[10px] text-text-secondary">· "{nlp.cleanTitle || value.trim()}"</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-1">
          {templates.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className="text-xs text-text-secondary hover:text-primary px-2 py-1 transition-colors"
                title="Modelos"
              >
                ⭐ Modelos
              </button>
              {showTemplates && (
                <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1 min-w-[180px]">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="flex items-center gap-1 px-1">
                      <button
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="flex-1 text-left px-2 py-2 text-xs text-text-main hover:bg-bg rounded-lg transition-colors truncate"
                      >
                        {tpl.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        className="text-[10px] text-text-secondary hover:text-danger px-1 transition-colors shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActive(false)}
            className="text-xs text-[#8E8E93] hover:text-text-main px-2 py-1 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="text-xs bg-primary text-white px-3 py-1 rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </form>
  );
}
