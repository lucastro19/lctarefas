import { useState } from "react";
import { Link } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";
import { useCollaboratorStore } from "../store/collaboratorStore";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { DelegatedRow } from "../components/delegation/DelegatedRow";
import { CollaboratorAvatar, agingDays, isFollowUpDue } from "../components/delegation/shared";
import { CollaboratorModal } from "../components/delegation/CollaboratorModal";
import { usePlanLimits } from "../hooks/usePlanLimits";

const FILTERS = [
  { key: "todas",    label: "Todas",             test: () => true },
  { key: "atrasadas", label: "Cobrar",           test: (t) => isFollowUpDue(t) },
  { key: "aceite",   label: "Aguardando aceite", test: (t) => t.delegation_status === "aguardando_aceite" },
  { key: "bloqueadas", label: "Bloqueadas",      test: (t) => t.delegation_status === "bloqueada" },
];

function PersonGroup({ collaborator, tasks, onOpen }) {
  const [open, setOpen] = useState(true);
  const overdue = tasks.filter(isFollowUpDue).length;

  return (
    <section className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 min-w-0 text-left group"
        >
          <span className="text-text-secondary text-xs w-3">{open ? "▾" : "▸"}</span>
          <CollaboratorAvatar collaborator={collaborator} size={24} />
          <span className="text-[15px] font-semibold text-text-main truncate group-hover:text-primary transition-colors">
            {collaborator?.name ?? "Sem colaborador"}
          </span>
          {collaborator?.role && (
            <span className="text-[11px] text-text-secondary truncate hidden sm:inline">{collaborator.role}</span>
          )}
        </button>
        <span className="text-[11px] font-bold tabular-nums text-text-secondary">{tasks.length}</span>
        {overdue > 0 && (
          <span className="text-[10px] font-bold bg-danger text-white rounded-full px-1.5 leading-5">
            {overdue} a cobrar
          </span>
        )}
        <div className="flex-1" />
        {collaborator && (
          <Link
            to={`/colaborador/${collaborator.id}`}
            className="text-[11px] text-primary hover:underline shrink-0"
          >
            Pauta 1:1 →
          </Link>
        )}
      </div>

      {open && (
        <div className="space-y-1.5 md:pl-5">
          {tasks.map((t) => (
            <DelegatedRow key={t.id} task={t} showAvatar={false} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

export function Delegadas() {
  const { getDelegated } = useTaskStore();
  const { collaborators } = useCollaboratorStore();
  const { canAddCollaborator } = usePlanLimits();
  const [filter, setFilter] = useState("todas");
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const all = getDelegated();
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const filtered = all.filter(active.test);
  const dueCount = all.filter(isFollowUpDue).length;

  // Mais paradas primeiro — é o que corre risco de ser esquecido
  const byAging = (a, b) => agingDays(b) - agingDays(a);

  // Ordena os grupos: quem tem cobrança vencida aparece antes
  const groups = collaborators
    .map((c) => ({ collaborator: c, tasks: filtered.filter((t) => t.delegated_to === c.id).sort(byAging) }))
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => {
      const aDue = a.tasks.filter(isFollowUpDue).length;
      const bDue = b.tasks.filter(isFollowUpDue).length;
      if (aDue !== bDue) return bDue - aDue;
      return b.tasks.length - a.tasks.length;
    });

  // Colaborador arquivado/removido: as tarefas não podem sumir da tela
  const orphans = filtered
    .filter((t) => !collaborators.some((c) => c.id === t.delegated_to))
    .sort(byAging);

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-text-main hidden md:block">Delegadas</h1>
          {dueCount > 0 && (
            <span className="text-xs font-semibold text-danger bg-danger/10 rounded-full px-2 py-1">
              {dueCount} para cobrar
            </span>
          )}
        </div>
        <p className="text-sm text-text-secondary mb-4">
          O que você delegou e ainda não voltou.
        </p>

        {/* Filtros */}
        <div className="flex items-center gap-1.5 mb-5 flex-wrap">
          {FILTERS.map((f) => {
            const count = all.filter(f.test).length;
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "bg-card border border-border text-text-secondary hover:text-text-main",
                ].join(" ")}
              >
                {f.label}
                {count > 0 && <span className="ml-1 tabular-nums opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {groups.length === 0 && orphans.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <span className="text-4xl block">🤝</span>
            <p className="text-[15px] font-medium text-text-main">
              {all.length === 0 ? "Nada delegado no momento" : "Nada neste filtro"}
            </p>
            <p className="text-sm text-text-secondary max-w-xs mx-auto">
              {collaborators.length === 0
                ? "Cadastre um colaborador e arraste uma tarefa até ele na barra lateral para delegar."
                : "Use o menu ··· de uma tarefa ou arraste-a até a pessoa na barra lateral."}
            </p>
            {collaborators.length === 0 && canAddCollaborator && (
              <button
                onClick={() => setShowNew(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                + Cadastrar colaborador
              </button>
            )}
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <PersonGroup
                key={g.collaborator.id}
                collaborator={g.collaborator}
                tasks={g.tasks}
                onOpen={setSelectedTask}
              />
            ))}
            {orphans.length > 0 && (
              <PersonGroup collaborator={null} tasks={orphans} onOpen={setSelectedTask} />
            )}
          </>
        )}
      </div>

      {selectedTask && (
        <TaskDetail key={selectedTask.id} task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      {showNew && <CollaboratorModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
