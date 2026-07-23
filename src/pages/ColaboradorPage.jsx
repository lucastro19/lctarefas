import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";
import { useCollaboratorStore } from "../store/collaboratorStore";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { DelegatedRow } from "../components/delegation/DelegatedRow";
import { CollaboratorModal } from "../components/delegation/CollaboratorModal";
import {
  CollaboratorAvatar, WhatsAppButton, isFollowUpDue, agingDays, fmtShortDate,
} from "../components/delegation/shared";
import { openWhatsApp, nudgeMessageMany } from "../utils/nudge";

const DAY = 86400000;

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-card border border-border rounded-card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-2xl font-bold text-text-main tabular-nums">{value}</span>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {sub && <span className="text-xs text-text-secondary/70">{sub}</span>}
    </div>
  );
}

function Section({ title, tasks, tone = "default", onOpen }) {
  if (tasks.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className={[
          "text-xs font-bold uppercase tracking-widest",
          tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text-secondary",
        ].join(" ")}>
          {title}
        </h2>
        <span className="text-[11px] font-bold tabular-nums text-text-secondary">{tasks.length}</span>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <DelegatedRow key={t.id} task={t} showAvatar={false} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

// Placar do colaborador, calculado sobre as tarefas já concluídas
function computeScore(open, done) {
  const onTime = done.filter((t) => !t.deadline || t.completed_at.slice(0, 10) <= t.deadline).length;
  const withDeadline = done.filter((t) => t.deadline).length;

  const durations = done
    .filter((t) => t.delegated_at && t.completed_at)
    .map((t) => (new Date(t.completed_at) - new Date(t.delegated_at)) / DAY)
    .filter((d) => d >= 0);
  const avgDays = durations.length
    ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
    : null;

  const nudges = done.map((t) => t.nudge_count ?? 0);
  const avgNudges = nudges.length
    ? (nudges.reduce((a, b) => a + b, 0) / nudges.length).toFixed(1)
    : null;

  return {
    onTimePct: withDeadline > 0 ? Math.round((onTime / withDeadline) * 100) : null,
    withDeadline,
    avgDays,
    avgNudges,
    openCount: open.length,
    doneCount: done.length,
  };
}

export function ColaboradorPage() {
  const { id } = useParams();
  const { getDelegatedBy, getDelegatedCompleted, revertAcceptedDelegation } = useTaskStore();
  const { getById } = useCollaboratorStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const [editing, setEditing] = useState(false);

  const collaborator = getById(id);
  const open = getDelegatedBy(id);
  const done = getDelegatedCompleted(id);

  if (!collaborator) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
        <span className="text-4xl">🫥</span>
        <p className="text-[15px] font-medium text-text-main">Colaborador não encontrado</p>
        <p className="text-sm text-text-secondary">Ele pode ter sido arquivado ou movido para a lixeira.</p>
        <Link to="/delegadas" className="text-sm text-primary hover:underline">Ver todas as delegadas</Link>
      </div>
    );
  }

  const toCollect = open.filter(isFollowUpDue).sort((a, b) => agingDays(b) - agingDays(a));
  const waitingAccept = open.filter((t) => t.delegation_status === "aguardando_aceite" && !isFollowUpDue(t));
  const blocked = open.filter((t) => t.delegation_status === "bloqueada" && !isFollowUpDue(t));
  const inProgress = open.filter(
    (t) => !isFollowUpDue(t) && !["aguardando_aceite", "bloqueada"].includes(t.delegation_status)
  ).sort((a, b) => agingDays(b) - agingDays(a));

  // Concluídas nos últimos 30 dias
  const cutoff = new Date(Date.now() - 30 * DAY).toISOString();
  const recentDone = done.filter((t) => t.completed_at >= cutoff);

  const score = computeScore(open, done);

  const handleNudgeAll = () => {
    const alvo = toCollect.length > 0 ? toCollect : open;
    if (alvo.length === 0) return;
    openWhatsApp(collaborator, nudgeMessageMany(collaborator, alvo));
  };

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-1">
          <CollaboratorAvatar collaborator={collaborator} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-text-main truncate leading-tight">
              {collaborator.name}
            </h1>
            {collaborator.role && (
              <p className="text-sm text-text-secondary truncate">{collaborator.role}</p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-text-secondary hover:text-text-main px-2 py-1 rounded-lg hover:bg-card transition-colors shrink-0"
          >
            Editar
          </button>
        </div>

        <div className="flex items-center gap-2 mb-5 mt-3 flex-wrap">
          <WhatsAppButton
            collaborator={collaborator}
            onClick={handleNudgeAll}
            label={toCollect.length > 0 ? `Cobrar ${toCollect.length} pendência${toCollect.length > 1 ? "s" : ""}` : "Chamar no WhatsApp"}
          />
          {collaborator.email && (
            <a
              href={`mailto:${collaborator.email}`}
              className="text-[11px] font-medium px-2 py-1 rounded-lg text-text-secondary bg-card border border-border hover:text-text-main transition-colors"
            >
              ✉️ {collaborator.email}
            </a>
          )}
        </div>

        {/* Placar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <StatCard label="Em aberto" value={score.openCount} sub={toCollect.length > 0 ? `${toCollect.length} a cobrar` : "em dia"} />
          <StatCard
            label="No prazo"
            value={score.onTimePct === null ? "—" : `${score.onTimePct}%`}
            sub={score.withDeadline > 0 ? `de ${score.withDeadline} com prazo` : "sem prazos ainda"}
          />
          <StatCard label="Tempo médio" value={score.avgDays === null ? "—" : `${score.avgDays}d`} sub="da delegação à entrega" />
          <StatCard label="Cobranças" value={score.avgNudges === null ? "—" : score.avgNudges} sub="média por tarefa" />
        </div>

        {open.length === 0 && recentDone.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <span className="text-4xl block">✨</span>
            <p className="text-[15px] font-medium text-text-main">Nada pendente com {collaborator.name.split(" ")[0]}</p>
            <p className="text-sm text-text-secondary">
              Arraste uma tarefa até o nome dele na barra lateral para delegar.
            </p>
          </div>
        ) : (
          <>
            <Section title="🔔 Cobrar agora" tasks={toCollect} tone="danger" onOpen={setSelectedTask} />
            <Section title="🚧 Bloqueadas" tasks={blocked} tone="warning" onOpen={setSelectedTask} />
            <Section title="👀 Aguardando meu aceite" tasks={waitingAccept} tone="warning" onOpen={setSelectedTask} />
            <Section title="Em aberto" tasks={inProgress} onOpen={setSelectedTask} />

            {recentDone.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-success">
                    ✅ Concluídas (30 dias)
                  </h2>
                  <span className="text-[11px] font-bold tabular-nums text-text-secondary">{recentDone.length}</span>
                </div>
                <div className="space-y-1">
                  {recentDone.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-card bg-card/60 border border-border min-w-0 group"
                    >
                      <span className="text-success text-xs shrink-0">✓</span>
                      <span className="text-[13px] text-text-secondary line-through truncate flex-1">{t.title}</span>
                      <span className="text-[10px] text-text-secondary/70 shrink-0 tabular-nums">
                        {fmtShortDate(t.completed_at.slice(0, 10))}
                      </span>
                      <button
                        onClick={() => revertAcceptedDelegation(t.id)}
                        title="Reverter aceite — volta para Delegadas, pendente"
                        className="opacity-0 group-hover:opacity-100 text-[10px] text-text-secondary hover:text-warning transition-all shrink-0"
                      >
                        ↺ Reverter
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {selectedTask && (
        <TaskDetail key={selectedTask.id} task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      {editing && <CollaboratorModal collaborator={collaborator} onClose={() => setEditing(false)} />}
    </div>
  );
}
