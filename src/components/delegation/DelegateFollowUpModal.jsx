import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTaskStore } from "../../store/taskStore";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { useUiStore } from "../../store/uiStore";
import { CollaboratorAvatar, inDays } from "./shared";

const QUICK_OPTIONS = [
  { label: "Amanhã", days: 1 },
  { label: "Em 3 dias", days: 3 },
  { label: "Em 1 semana", days: 7 },
];

// Modal aberto sempre que uma tarefa é delegada (menu ···, painel lateral ou
// drag-and-drop para um colaborador na barra lateral) — força escolher a data
// de cobrança na hora, em vez de cair sempre no padrão de 3 dias.
export function DelegateFollowUpModal() {
  const delegateFlow = useUiStore((s) => s.delegateFlow);
  const closeDelegateFlow = useUiStore((s) => s.closeDelegateFlow);
  const tasks = useTaskStore((s) => s.tasks);
  const delegateTask = useTaskStore((s) => s.delegateTask);
  const collaborators = useCollaboratorStore((s) => s.collaborators);
  const [date, setDate] = useState(inDays(3));

  // ESC aborta a delegação (mesmo efeito do clique fora/Cancelar) — não chama delegateTask
  useEffect(() => {
    if (!delegateFlow) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeDelegateFlow(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [delegateFlow, closeDelegateFlow]);

  if (!delegateFlow) return null;
  const { taskId, collaboratorId, note } = delegateFlow;
  const task = tasks.find((t) => t.id === taskId);
  const collaborator = collaborators.find((c) => c.id === collaboratorId);
  if (!task) return null;

  const confirm = () => {
    delegateTask(taskId, { collaboratorId, followUpDate: date, note });
    closeDelegateFlow();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-end md:items-center justify-center"
      onClick={closeDelegateFlow}
    >
      <div
        className="bg-card rounded-t-2xl md:rounded-2xl w-full max-w-sm px-5 pt-4 pb-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3 md:hidden" />

        <div className="flex items-center gap-2 mb-1">
          <CollaboratorAvatar collaborator={collaborator} size={22} />
          <h3 className="text-base font-semibold text-text-main truncate">
            Delegar para {collaborator?.name ?? "colaborador"}
          </h3>
        </div>
        <p className="text-xs text-text-secondary mb-4">Quando devo lembrar de cobrar essa tarefa?</p>

        <div className="flex gap-2 mb-3">
          {QUICK_OPTIONS.map((opt) => {
            const optDate = inDays(opt.days);
            return (
              <button
                key={opt.days}
                onClick={() => setDate(optDate)}
                className={[
                  "flex-1 text-xs font-medium py-2 rounded-xl transition-colors",
                  date === optDate ? "bg-primary text-white" : "bg-bg text-text-secondary hover:text-text-main",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-bg rounded-xl px-3 py-2 text-sm text-text-main mb-4 outline-none"
        />

        <div className="flex gap-2">
          <button
            onClick={closeDelegateFlow}
            className="flex-1 py-2.5 text-sm text-text-secondary hover:text-text-main transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={!date}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-xl transition-colors"
          >
            Delegar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
