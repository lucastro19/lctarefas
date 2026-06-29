import { useState } from "react";
import { useTaskStore } from "../store/taskStore";

const dateStr = (d) => d.toISOString().split("T")[0];

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

export function Logbook() {
  const { getAllCompleted, deleteTask, permanentDeleteTask } = useTaskStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const tasks = getAllCompleted();

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
        <h1 className="text-2xl font-semibold text-text-main">Histórico</h1>
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
