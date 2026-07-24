import { useState } from "react";
import { Link } from "react-router-dom";
import { useTaskStore } from "../store/taskStore";
import { useAreaStore } from "../store/areaStore";
import { useOrgStore } from "../store/orgStore";
import { useCollaboratorStore } from "../store/collaboratorStore";
import { CollaboratorAvatar } from "../components/delegation/shared";

const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function formatGroupDate(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateStr(d) === dateStr(today)) return "Hoje";
  if (dateStr(d) === dateStr(yesterday)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return dateStr(d);
  });
}

function getStreak(groups) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateStr(d);
    if (!groups[key]) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-card border border-border rounded-card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-2xl font-bold text-text-main">{value}</span>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {sub && <span className="text-xs text-text-secondary/70">{sub}</span>}
    </div>
  );
}

function WeekChart({ days, groups }) {
  const counts = days.map((d) => (groups[d] ?? []).length);
  const max = Math.max(...counts, 1);

  return (
    <div className="bg-card border border-border rounded-card px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Últimos 7 dias</p>
      <div className="flex items-end gap-2 h-16">
        {days.map((day, i) => {
          const count = counts[i];
          const heightPct = count === 0 ? 4 : Math.max(12, Math.round((count / max) * 100));
          const isToday = day === dateStr(new Date());
          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-text-secondary">{count || ""}</span>
              <div
                className={["rounded-sm transition-all", isToday ? "bg-primary" : "bg-primary/30"].join(" ")}
                style={{ height: `${heightPct}%`, width: "100%" }}
              />
              <span className="text-[10px] text-text-secondary">
                {new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "narrow" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function AdvancedStats({ tasks, groups, areas, demandTypes }) {
  // Best weekday
  const byWeekday = Array(7).fill(0);
  tasks.forEach((t) => { byWeekday[new Date(t.completed_at).getDay()]++; });
  const bestDay = byWeekday.indexOf(Math.max(...byWeekday));
  const maxWd = Math.max(...byWeekday, 1);

  // Average per active day
  const activeDays = Object.keys(groups).length;
  const avg = activeDays > 0 ? (tasks.length / activeDays).toFixed(1) : "—";

  // Completion rate vs total created (approximation: completed / (completed + active))
  const { getInbox, getToday, getSomeday } = useTaskStore.getState();
  const active = getInbox().length + getToday().length + getSomeday().length;
  const total = tasks.length + active;
  const rate = total > 0 ? Math.round((tasks.length / total) * 100) : 0;

  // By area
  const byArea = {};
  tasks.forEach((t) => {
    if (!t.area_id) return;
    byArea[t.area_id] = (byArea[t.area_id] ?? 0) + 1;
  });
  const areaEntries = Object.entries(byArea)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, cnt]) => ({ area: areas.find((a) => a.id === id), cnt }))
    .filter((e) => e.area);

  // By demand type — só tarefas organizacionais têm demand_type_id setado.
  const byDemandType = {};
  tasks.forEach((t) => {
    if (!t.demand_type_id) return;
    byDemandType[t.demand_type_id] = (byDemandType[t.demand_type_id] ?? 0) + 1;
  });
  const demandTypeEntries = Object.entries(byDemandType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, cnt]) => ({ demandType: demandTypes.find((d) => d.id === id), cnt }))
    .filter((e) => e.demandType);

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Média por dia" value={avg} sub="tarefas/dia ativo" />
        <StatCard label="Taxa de conclusão" value={`${rate}%`} sub={`${tasks.length} de ${total}`} />
      </div>

      {/* Best weekday bar chart */}
      <div className="bg-card border border-border rounded-card px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Por dia da semana</p>
        <div className="flex items-end gap-1.5 h-14">
          {WEEKDAY_LABELS.map((label, i) => {
            const count = byWeekday[i];
            const h = count === 0 ? 4 : Math.max(8, Math.round((count / maxWd) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-text-secondary">{count || ""}</span>
                <div
                  className={["rounded-sm transition-all", i === bestDay && count > 0 ? "bg-success" : "bg-primary/30"].join(" ")}
                  style={{ height: `${h}%`, width: "100%" }}
                />
                <span className={["text-[9px]", i === bestDay && count > 0 ? "text-success font-semibold" : "text-text-secondary"].join(" ")}>{label}</span>
              </div>
            );
          })}
        </div>
        {byWeekday[bestDay] > 0 && (
          <p className="text-[11px] text-text-secondary mt-2">
            Você é mais produtivo às <span className="font-semibold text-success">{WEEKDAY_LABELS[bestDay]}s</span> 🏆
          </p>
        )}
      </div>

      {/* By area */}
      {areaEntries.length > 0 && (
        <div className="bg-card border border-border rounded-card px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Por área</p>
          <div className="space-y-2">
            {areaEntries.map(({ area, cnt }) => (
              <div key={area.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                <span className="text-xs text-text-main flex-1 truncate">{area.name}</span>
                <span className="text-xs font-medium text-text-secondary shrink-0">{cnt}</span>
                <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden shrink-0">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((cnt / tasks.length) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By demand type */}
      {demandTypeEntries.length > 0 && (
        <div className="bg-card border border-border rounded-card px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Por tipo de demanda</p>
          <div className="space-y-2">
            {demandTypeEntries.map(({ demandType, cnt }) => (
              <div key={demandType.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: demandType.color }} />
                <span className="text-xs text-text-main flex-1 truncate">{demandType.label}</span>
                <span className="text-xs font-medium text-text-secondary shrink-0">{cnt}</span>
                <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden shrink-0">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((cnt / tasks.length) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DAY_MS = 86400000;

/*
  Placar da equipe — mede a delegação, não a execução própria.
  "No prazo" só considera tarefas que tinham deadline combinado.
*/
function TeamStats({ collaborators, done, open }) {
  const rows = collaborators
    .map((c) => {
      const cDone = done.filter((t) => t.delegated_to === c.id);
      const cOpen = open.filter((t) => t.delegated_to === c.id);
      const withDeadline = cDone.filter((t) => t.deadline);
      const onTime = withDeadline.filter((t) => t.completed_at.slice(0, 10) <= t.deadline).length;
      const durations = cDone
        .filter((t) => t.delegated_at)
        .map((t) => (new Date(t.completed_at) - new Date(t.delegated_at)) / DAY_MS)
        .filter((d) => d >= 0);
      const nudges = cDone.map((t) => t.nudge_count ?? 0);
      return {
        c,
        done: cDone.length,
        open: cOpen.length,
        onTimePct: withDeadline.length > 0 ? Math.round((onTime / withDeadline.length) * 100) : null,
        avgDays: durations.length ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : null,
        avgNudges: nudges.length ? (nudges.reduce((a, b) => a + b, 0) / nudges.length).toFixed(1) : null,
      };
    })
    .filter((r) => r.done > 0 || r.open > 0)
    .sort((a, b) => b.done - a.done);

  if (rows.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-card px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Equipe</p>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <Link
            key={r.c.id}
            to={`/colaborador/${r.c.id}`}
            className="flex items-center gap-2 group"
          >
            <CollaboratorAvatar collaborator={r.c} size={24} />
            <span className="text-sm text-text-main truncate flex-1 min-w-0 group-hover:text-primary transition-colors">
              {r.c.name}
            </span>
            <span className="text-[11px] text-text-secondary tabular-nums shrink-0 w-16 text-right">
              {r.done} entregue{r.done !== 1 ? "s" : ""}
            </span>
            <span
              className={[
                "text-[11px] font-semibold tabular-nums shrink-0 w-12 text-right",
                r.onTimePct === null ? "text-text-secondary/60"
                  : r.onTimePct >= 80 ? "text-success"
                  : r.onTimePct >= 50 ? "text-warning" : "text-danger",
              ].join(" ")}
              title="Entregas dentro do prazo combinado"
            >
              {r.onTimePct === null ? "—" : `${r.onTimePct}%`}
            </span>
            <span className="text-[11px] text-text-secondary tabular-nums shrink-0 w-12 text-right" title="Tempo médio até a entrega">
              {r.avgDays === null ? "—" : `${r.avgDays}d`}
            </span>
            <span className="text-[11px] text-text-secondary tabular-nums shrink-0 w-14 text-right hidden sm:block" title="Média de cobranças por tarefa">
              {r.avgNudges === null ? "—" : `${r.avgNudges}×`}
            </span>
          </Link>
        ))}
      </div>
      <p className="text-[10px] text-text-secondary/70 mt-3">
        entregues · % no prazo · tempo médio · cobranças por tarefa
      </p>
    </div>
  );
}

export function Logbook() {
  const { getAllCompleted, deleteTask, permanentDeleteTask, getDelegatedCompleted, getDelegated } = useTaskStore();
  const { areas } = useAreaStore();
  const { demandTypes } = useOrgStore();
  const { collaborators } = useCollaboratorStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const tasks = getAllCompleted();
  const delegatedDone = getDelegatedCompleted();
  const delegatedOpen = getDelegated();

  const groups = tasks.reduce((acc, task) => {
    const day = task.completed_at.split("T")[0];
    if (!acc[day]) acc[day] = [];
    acc[day].push(task);
    return acc;
  }, {});

  const last7 = getLast7Days();
  const todayKey = dateStr(new Date());
  const weekStart = last7[0];

  const todayCount = (groups[todayKey] ?? []).length;
  const weekCount = last7.reduce((sum, d) => sum + (groups[d] ?? []).length, 0);
  const streak = getStreak(groups);
  const sortedDays = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl">
      <div className="flex items-start justify-between mb-1 gap-4">
        <h1 className="hidden md:block text-2xl font-semibold text-text-main">Histórico</h1>
        {tasks.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-text-secondary">Limpar tudo?</span>
              <button
                onClick={async () => {
                  await Promise.all(tasks.map((t) => permanentDeleteTask(t.id)));
                  setConfirmClear(false);
                }}
                className="text-xs text-danger font-medium hover:underline"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs text-text-secondary hover:underline"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs text-text-secondary hover:text-danger transition-colors shrink-0 mt-1"
            >
              Limpar tudo
            </button>
          )
        )}
      </div>
      <p className="text-sm text-text-secondary mb-6">
        {tasks.length === 0 ? "Nenhuma tarefa concluída ainda." : `${tasks.length} tarefa${tasks.length !== 1 ? "s" : ""} concluída${tasks.length !== 1 ? "s" : ""} no total`}
      </p>

      {tasks.length > 0 && (
        <div className="mb-8 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Hoje" value={todayCount} />
            <StatCard label="Esta semana" value={weekCount} sub={`desde ${new Date(weekStart + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`} />
            <StatCard label="Sequência" value={streak > 0 ? `${streak}d` : "—"} sub={streak > 0 ? "dias consecutivos" : "nenhum dia ainda"} />
          </div>
          <WeekChart days={last7} groups={groups} />

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full text-xs text-text-secondary hover:text-primary transition-colors py-1 text-center"
          >
            {showAdvanced ? "▲ Menos estatísticas" : "▼ Estatísticas avançadas"}
          </button>
          {showAdvanced && <AdvancedStats tasks={tasks} groups={groups} areas={areas} demandTypes={demandTypes} />}
          {showAdvanced && (
            <TeamStats collaborators={collaborators} done={delegatedDone} open={delegatedOpen} />
          )}
        </div>
      )}

      {sortedDays.map((day) => (
        <section key={day} className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2 capitalize flex items-center gap-2">
            {formatGroupDate(day)}
            <span className="font-normal normal-case tracking-normal">· {groups[day].length}</span>
          </p>
          <div className="space-y-1">
            {groups[day].map((task) => (
              <div key={task.id} className="flex items-center gap-3 bg-card border border-border rounded-card px-4 py-2.5 group">
                <span className="text-success text-base shrink-0">✓</span>
                <p className="text-sm text-text-secondary line-through flex-1 truncate">{task.title}</p>
                <span className="text-xs text-text-secondary shrink-0">
                  {new Date(task.completed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => permanentDeleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-danger transition-all text-xs shrink-0"
                  title="Remover do histórico"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}

      {tasks.length === 0 && (
        <p className="text-sm text-text-secondary text-center py-12">
          Suas tarefas concluídas aparecerão aqui. 📋
        </p>
      )}
    </div>
  );
}
