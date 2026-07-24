import { useEffect, useState } from "react";
import { useOrgStore, ROLE_LABELS } from "../store/orgStore";
import { useTaskStore } from "../store/taskStore";
import { CollaboratorAvatar, StatusPill, AgingLabel, FollowUpLabel, NudgeCountLabel, agingDays, isFollowUpDue } from "../components/delegation/shared";

function fmtShortDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

// Fase 2.8: pedidos de prorrogação de prazo onde o gestor logado é o
// aprovador — só aparece quando há algo pendente, sem seção vazia.
function DeadlineExtensionRequests() {
  const { fetchPendingDeadlineExtensions, resolveDeadlineExtension } = useTaskStore();
  const [requests, setRequests] = useState([]);
  const [resolvingId, setResolvingId] = useState(null);

  const load = () => fetchPendingDeadlineExtensions().then(setRequests);
  useEffect(() => { load(); }, []);

  const handleResolve = async (id, approve) => {
    setResolvingId(id);
    await resolveDeadlineExtension(id, approve);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setResolvingId(null);
  };

  if (requests.length === 0) return null;

  return (
    <section className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary px-1 pb-1.5">
        Pedidos de prorrogação
      </p>
      <div className="space-y-1.5">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center gap-2 px-3 py-2.5 rounded-card bg-card border border-border min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-text-main truncate leading-tight">{r.tasks?.title ?? "Tarefa"}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                {fmtShortDate(r.current_deadline)} → {fmtShortDate(r.requested_deadline)}
                {r.reason && ` · "${r.reason}"`}
              </p>
            </div>
            <button
              onClick={() => handleResolve(r.id, false)}
              disabled={resolvingId === r.id}
              className="text-[11px] font-medium px-2 py-1 rounded-lg text-danger bg-danger/10 hover:bg-danger/20 transition-colors disabled:opacity-50"
            >
              Recusar
            </button>
            <button
              onClick={() => handleResolve(r.id, true)}
              disabled={resolvingId === r.id}
              className="text-[11px] font-medium px-2 py-1 rounded-lg text-success bg-success/10 hover:bg-success/20 transition-colors disabled:opacity-50"
            >
              Aprovar
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// Linha somente-leitura: o gestor no roll-up não é dono nem executor da tarefa,
// então não há ação possível aqui (RLS bloqueia update de qualquer forma) — só acompanhamento.
function TeamTaskRow({ task, delegator }) {
  const status = task.delegation_status ?? "pendente";
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-card bg-card border border-border min-w-0">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-text-main truncate leading-tight">{task.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <StatusPill status={status} />
          <AgingLabel task={task} />
          <FollowUpLabel task={task} />
          <NudgeCountLabel task={task} />
          {delegator && (
            <span className="text-[10px] text-text-secondary shrink-0" title="Quem delegou">
              via {delegator.profile?.full_name ?? "?"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonGroup({ member, tasks, getMemberByUserId }) {
  const overdue = tasks.filter(isFollowUpDue).length;
  const avatar = { name: member?.profile?.full_name ?? "Sem membro", avatar_url: member?.profile?.avatar_url };

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <CollaboratorAvatar collaborator={avatar} size={24} />
        <span className="text-[15px] font-semibold text-text-main truncate">{avatar.name}</span>
        {member?.role && (
          <span className="text-[11px] text-text-secondary truncate hidden sm:inline">{ROLE_LABELS[member.role]}</span>
        )}
        <span className="text-[11px] font-bold tabular-nums text-text-secondary">{tasks.length}</span>
        {overdue > 0 && (
          <span className="text-[10px] font-bold bg-danger text-white rounded-full px-1.5 leading-5">
            {overdue} atrasada{overdue > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="space-y-1.5 md:pl-5">
        {tasks.map((t) => (
          <TeamTaskRow key={t.id} task={t} delegator={getMemberByUserId(t.user_id)} />
        ))}
      </div>
    </section>
  );
}

export function Cockpit() {
  const { organization, loaded, teamTasks, fetchOrganization, fetchTeamTasks, getMemberByUserId } = useOrgStore();

  useEffect(() => {
    if (!loaded) fetchOrganization();
  }, [loaded]);

  useEffect(() => {
    if (organization) fetchTeamTasks();
  }, [organization]);

  // Mais paradas primeiro — mesmo critério de "Delegadas"
  const byAging = (a, b) => agingDays(b) - agingDays(a);

  const groups = organization
    ? Object.values(
        teamTasks.reduce((acc, t) => {
          const key = t.assignee_id ?? "orphan";
          if (!acc[key]) acc[key] = { member: getMemberByUserId(t.assignee_id), tasks: [] };
          acc[key].tasks.push(t);
          return acc;
        }, {})
      )
        .map((g) => ({ ...g, tasks: g.tasks.sort(byAging) }))
        .sort((a, b) => b.tasks.length - a.tasks.length)
    : [];

  return (
    <div className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
      <h1 className="text-2xl font-semibold text-text-main hidden md:block mb-1">Cockpit</h1>
      <p className="text-sm text-text-secondary mb-4">
        Trabalho corporativo da sua equipe, via roll-up hierárquico — só acompanhamento.
      </p>

      {!organization ? (
        <div className="text-center py-16 space-y-3">
          <span className="text-4xl block">🧭</span>
          <p className="text-[15px] font-medium text-text-main">Você ainda não faz parte de uma organização</p>
        </div>
      ) : (
        <>
          <DeadlineExtensionRequests />
          {groups.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <span className="text-4xl block">🧭</span>
              <p className="text-[15px] font-medium text-text-main">Sua equipe não tem tarefas corporativas em aberto</p>
            </div>
          ) : (
            groups.map((g) => (
              <PersonGroup key={g.member?.id ?? "orphan"} member={g.member} tasks={g.tasks} getMemberByUserId={getMemberByUserId} />
            ))
          )}
        </>
      )}
    </div>
  );
}
