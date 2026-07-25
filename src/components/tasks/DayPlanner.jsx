import { useState } from "react";
import { createPortal } from "react-dom";
import { useTaskStore } from "../../store/taskStore";

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Planejamento guiado do dia (Fase 4.8, estilo Sunsama) — revisão rápida de atrasadas + Inbox
// sem data, triagem de 1 clique por linha. Reaproveita getReviewToday/getInbox que já existem
// (nenhum fetch novo); Hoje/Amanhã só chamam updateTask com scheduled_date, igual ao resto do app.
export function DayPlanner({ onClose }) {
  const { getReviewToday, getInbox, updateTask } = useTaskStore();
  const [dismissed, setDismissed] = useState(() => new Set());

  const overdue = getReviewToday();
  const inboxTasks = getInbox();
  const overdueIds = new Set(overdue.map((t) => t.id));

  const rows = [...overdue, ...inboxTasks]
    .filter((t) => !dismissed.has(t.id))
    .map((t) => ({ ...t, _late: overdueIds.has(t.id) }));

  const markDone = (id) => setDismissed((prev) => new Set(prev).add(id));

  const act = async (task, action) => {
    if (action === "hoje") await updateTask(task.id, { scheduled_date: addDays(0), someday: false });
    if (action === "amanha") await updateTask(task.id, { scheduled_date: addDays(1), someday: false });
    markDone(task.id);
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-[17px] font-semibold text-text-main">Planejar seu dia</h2>
          <p className="text-[13px] text-text-secondary mt-1">
            {overdue.length} atrasada{overdue.length !== 1 ? "s" : ""} · {inboxTasks.length} no Inbox sem data — decida rápido o que entra hoje:
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {rows.length === 0 ? (
            <p className="text-center text-success text-sm font-medium py-10">Tudo revisado! Bom trabalho hoje ✅</p>
          ) : (
            rows.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl">
                <span className="flex-1 min-w-0 text-[13px] text-text-main truncate">
                  {t.title}
                  {t._late && <span className="ml-1.5 text-[10px] font-bold text-danger">atrasada</span>}
                </span>
                <button
                  onClick={() => act(t, "hoje")}
                  className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary shrink-0"
                >
                  Hoje
                </button>
                <button
                  onClick={() => act(t, "amanha")}
                  className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-bg text-text-secondary shrink-0"
                >
                  Amanhã
                </button>
                <button
                  onClick={() => markDone(t.id)}
                  title="Descartar da lista de hoje (não altera a tarefa)"
                  className="text-text-secondary/60 hover:text-danger px-1 shrink-0"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Começar o dia →
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
