import { useState, useEffect } from "react";
import { useTaskStore } from "../../store/taskStore";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { useOrgStore } from "../../store/orgStore";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { openWhatsApp, nudgeMessage } from "../../utils/nudge";
import {
  CollaboratorAvatar, WhatsAppButton, STATUS_META, STATUS_ORDER, agingDays, fmtShortDate, inDays,
} from "./shared";

// Fase 2.7: se o colaborador escolhido é vinculado e tem um gestor direto
// diferente de quem está delegando, é uma delegação "pulando nível" — pode
// opcionalmente incluir esse gestor como observador ativo. Retorna null
// quando não há nada a pular (sem vínculo, sem gestor definido, ou o próprio
// delegador já é o gestor direto).
function computeSkipLevel({ collaborator, members, getMemberByUserId, myUserId, myCollaborators }) {
  if (!collaborator?.linked_user_id) return null;
  const targetMember = getMemberByUserId(collaborator.linked_user_id);
  if (!targetMember?.manager_id) return null;
  const managerMember = members.find((m) => m.id === targetMember.manager_id);
  if (!managerMember || managerMember.user_id === myUserId) return null;
  const watcherCandidate = myCollaborators.find((c) => c.linked_user_id === managerMember.user_id);
  return {
    managerName: managerMember.profile?.full_name ?? managerMember.profile?.email ?? "o gestor direto",
    watcherCandidateId: watcherCandidate?.id ?? null,
  };
}

/*
  Seção "Delegação" do TaskDetail.
  Lê a tarefa direto do store para refletir as ações na hora (status, cobrança, aceite).
*/
export function DelegationSection({ taskId, fallbackTask }) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId)) ?? fallbackTask;
  const {
    undelegateTask, setDelegationStatus, acceptDelegatedTask, registerNudge, updateTask,
    fetchDelegationChain,
  } = useTaskStore();
  const { collaborators } = useCollaboratorStore();
  const { members, getMemberByUserId } = useOrgStore();
  const { user } = useAuthStore();
  const { showToast, openDelegateFlow } = useUiStore();

  const [note, setNote] = useState(task?.delegation_note ?? "");
  const [picking, setPicking] = useState(false);
  const [pendingPick, setPendingPick] = useState(null); // { collaboratorId, managerName, watcherCandidateId }
  const [includeWatcher, setIncludeWatcher] = useState(false);
  const [chain, setChain] = useState([]);

  useEffect(() => { setNote(task?.delegation_note ?? ""); }, [taskId]);

  useEffect(() => {
    if (task?.delegated_to) fetchDelegationChain(taskId).then(setChain);
    else setChain([]);
  }, [taskId, task?.current_delegation_id]);

  if (!task) return null;

  const collaborator = collaborators.find((c) => c.id === task.delegated_to) ?? null;
  const status = task.delegation_status ?? "pendente";
  // Redelegar exige executor com conta vinculada — colaborador local sem
  // conta é sempre terminal (só o dono original pode reatribuir depois).
  const canRedelegate = !!task.assignee_id && task.assignee_id === user?.id;
  const canPick = !task.delegated_to || canRedelegate;

  const handleNudge = () => {
    if (!openWhatsApp(collaborator, nudgeMessage(collaborator, task))) return;
    registerNudge(task.id, inDays(2));
    showToast({ message: "Cobrança registrada" });
  };

  const handlePick = (c) => {
    const skip = computeSkipLevel({
      collaborator: c, members, getMemberByUserId, myUserId: user?.id, myCollaborators: collaborators,
    });
    if (skip) {
      setPendingPick({ collaboratorId: c.id, ...skip });
      setIncludeWatcher(false);
    } else {
      openDelegateFlow(task.id, c.id, note || null);
      setPicking(false);
    }
  };

  const confirmPendingPick = () => {
    openDelegateFlow(
      task.id, pendingPick.collaboratorId, note || null,
      includeWatcher ? pendingPick.watcherCandidateId : null
    );
    setPendingPick(null);
    setPicking(false);
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
            <span className="flex-1 text-[14px] text-text-main">
              {canRedelegate ? "Redelegar para" : "Delegada para"}
            </span>
            {canPick ? (
              <button
                onClick={() => { setPicking(!picking); setPendingPick(null); }}
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
            ) : (
              collaborator && (
                <span className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                  <CollaboratorAvatar collaborator={collaborator} size={20} />
                  <span className="truncate max-w-[120px]">{collaborator.name}</span>
                </span>
              )
            )}
          </div>

          {!canPick && task.delegated_to && (
            <p className="text-[11px] text-text-secondary mt-1">
              Sem acesso ao app — só quem delegou pode reatribuir esta tarefa.
            </p>
          )}

          {picking && (
            <div className="mt-2 rounded-xl border border-border overflow-hidden">
              {collaborators.length === 0 && (
                <p className="px-3 py-2 text-xs text-text-secondary">
                  Cadastre uma pessoa na barra lateral (seção Equipe).
                </p>
              )}
              {collaborators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handlePick(c)}
                  className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
                >
                  <CollaboratorAvatar collaborator={c} size={20} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {task.delegated_to === c.id && <span className="text-primary text-xs">✓</span>}
                </button>
              ))}
              {task.delegated_to && !canRedelegate && (
                <button
                  onClick={() => { undelegateTask(task.id); setPicking(false); }}
                  className="menu-item w-full text-left px-3 py-2.5 text-sm text-danger transition-colors"
                >
                  ✕ Remover delegação
                </button>
              )}

              {pendingPick && (
                <div className="p-3 border-t border-border bg-bg space-y-2">
                  <p className="text-xs text-text-secondary">
                    Isso pula {pendingPick.managerName}, gestor direto dessa pessoa.
                  </p>
                  {pendingPick.watcherCandidateId ? (
                    <label className="flex items-center gap-2 text-[13px] text-text-main">
                      <input
                        type="checkbox"
                        checked={includeWatcher}
                        onChange={(e) => setIncludeWatcher(e.target.checked)}
                      />
                      Incluir {pendingPick.managerName} como observador(a)
                    </label>
                  ) : (
                    <p className="text-[11px] text-text-secondary">
                      Cadastre um contato pra {pendingPick.managerName} se quiser incluir como observador(a).
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPendingPick(null)}
                      className="flex-1 text-xs py-1.5 rounded-lg text-text-secondary hover:bg-card transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmPendingPick}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-primary text-white hover:opacity-90 transition-opacity"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
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

            {/* Histórico da cadeia (Fase 2.7) — só quando já houve redelegação */}
            {chain.length > 1 && (
              <div className="px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                  Histórico da delegação
                </p>
                <div className="space-y-1">
                  {chain.map((elo) => {
                    const isCurrent = elo.id === task.current_delegation_id;
                    const delegatorName = getMemberByUserId(elo.delegator_id)?.profile?.full_name?.split(" ")[0] ?? "?";
                    const assigneeName = elo.assignee_user_id
                      ? (getMemberByUserId(elo.assignee_user_id)?.profile?.full_name?.split(" ")[0] ?? "?")
                      : (collaborators.find((c) => c.id === elo.collaborator_id)?.name?.split(" ")[0] ?? "contato local");
                    return (
                      <p key={elo.id} className="text-[11px] text-text-secondary">
                        {delegatorName} → {assigneeName}
                        {isCurrent ? " · atual" : elo.status === "concluida" ? " · aceito ✓" : ""}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

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
