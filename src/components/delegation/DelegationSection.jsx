import { useState, useEffect } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { useUiStore } from "../../store/uiStore";
import { openWhatsApp, nudgeMessage } from "../../utils/nudge";
import {
  CollaboratorAvatar, WhatsAppButton, STATUS_META, STATUS_ORDER, agingDays, fmtShortDate, inDays,
} from "./shared";

/*
  Seção "Delegação" do TaskDetail.
  Lê a tarefa direto do store para refletir as ações na hora (status, cobrança, aceite).
*/
export function DelegationSection({ taskId, fallbackTask }) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId)) ?? fallbackTask;
  const { undelegateTask, setDelegationStatus, acceptDelegatedTask, registerNudge, updateTask } = useTaskStore();
  const { collaborators } = useCollaboratorStore();
  const { showToast, openDelegateFlow } = useUiStore();

  const [note, setNote] = useState(task?.delegation_note ?? "");
  const [picking, setPicking] = useState(false);

  useEffect(() => { setNote(task?.delegation_note ?? ""); }, [taskId]);

  if (!task) return null;

  const collaborator = collaborators.find((c) => c.id === task.delegated_to) ?? null;
  const status = task.delegation_status ?? "pendente";

  const handleNudge = () => {
    if (!openWhatsApp(collaborator, nudgeMessage(collaborator, task))) return;
    registerNudge(task.id, inDays(2));
    showToast({ message: "Cobrança registrada" });
  };

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary px-1 pb-1.5 pt-4">
        Delegação
      </p>
      <div className="rounded-2xl overflow-hidden bg-card divide-y divide-border/50">
        {/* Quem */}
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[15px] w-5 text-center leading-none">🤝</span>
            <span className="flex-1 text-[14px] text-text-main">Delegada para</span>
            <button
              onClick={() => setPicking(!picking)}
              className="flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-main transition-colors"
            >
              {collaborator ? (
                <>
                  <CollaboratorAvatar collaborator={collaborator} size={20} />
                  <span className="truncate max-w-[120px]">{collaborator.name}</span>
                </>
              ) : (
                <span>Ninguém</span>
              )}
              <span className="text-xs">›</span>
            </button>
          </div>

          {picking && (
            <div className="mt-2 rounded-xl border border-border overflow-hidden">
              {collaborators.length === 0 && (
                <p className="px-3 py-2 text-xs text-text-secondary">
                  Cadastre um colaborador na barra lateral (seção Equipe).
                </p>
              )}
              {collaborators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    openDelegateFlow(task.id, c.id, note || null);
                    setPicking(false);
                  }}
                  className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
                >
                  <CollaboratorAvatar collaborator={c} size={20} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {task.delegated_to === c.id && <span className="text-primary text-xs">✓</span>}
                </button>
              ))}
              {task.delegated_to && (
                <button
                  onClick={() => { undelegateTask(task.id); setPicking(false); }}
                  className="menu-item w-full text-left px-3 py-2.5 text-sm text-danger transition-colors"
                >
                  ✕ Remover delegação
                </button>
              )}
            </div>
          )}
        </div>

        {task.delegated_to && (
          <>
            {/* Status */}
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[15px] w-5 text-center leading-none">{STATUS_META[status]?.icon}</span>
              <span className="flex-1 text-[14px] text-text-main">Status</span>
              <select
                value={status}
                onChange={(e) => setDelegationStatus(task.id, e.target.value)}
                className="text-[13px] bg-bg border border-border/60 rounded-lg px-2 py-1 outline-none focus:border-primary text-text-main"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>

            {/* Cobrar em */}
            <div className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[15px] w-5 text-center leading-none">🔔</span>
              <span className="flex-1 text-[14px] text-text-main">Cobrar em</span>
              <input
                type="date"
                value={task.follow_up_date ?? ""}
                onChange={(e) => updateTask(task.id, { follow_up_date: e.target.value || null })}
                className="text-[13px] bg-bg border border-border/60 rounded-lg px-2 py-1 outline-none focus:border-primary text-text-main"
              />
            </div>

            {/* O combinado */}
            <div className="px-4 py-2.5">
              <span className="text-[14px] text-text-main">O combinado / definição de pronto</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if ((task.delegation_note ?? "") !== note)
                    updateTask(task.id, { delegation_note: note || null });
                }}
                rows={2}
                placeholder="O que precisa estar entregue para considerar pronto?"
                className="mt-1.5 w-full text-[13px] bg-bg border border-border/60 rounded-xl px-3 py-2 outline-none focus:border-primary text-text-main resize-none"
              />
            </div>

            {/* Resumo + ações */}
            <div className="px-4 py-2.5 space-y-2">
              <p className="text-[12px] text-text-secondary">
                Delegada {fmtShortDate(task.delegated_at?.slice(0, 10))} · {agingDays(task)}d sem atualização
                {task.nudge_count > 0 && ` · cobrada ${task.nudge_count}×`}
              </p>
              <div className="flex items-center gap-2">
                <WhatsAppButton collaborator={collaborator} onClick={handleNudge} />
                <button
                  onClick={() => acceptDelegatedTask(task.id)}
                  className="text-[11px] font-medium px-2 py-1 rounded-lg text-success bg-success/10 hover:bg-success/20 transition-colors"
                >
                  Aceitar e concluir
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
