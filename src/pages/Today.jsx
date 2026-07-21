import { useState, useEffect, useRef } from "react";
import { TimedTaskList } from "../components/tasks/TimedTaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { FollowUpPanel } from "../components/tasks/FollowUpPanel";
import { useTaskStore } from "../store/taskStore";
import { useUiStore } from "../store/uiStore";

function localDateStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function motivationalMsg(pct) {
  if (pct === 0) return "Vamos lá! Qual tarefa você vai atacar primeiro?";
  if (pct < 0.3) return "Bom começo! Continue assim.";
  if (pct < 0.5) return "Bom ritmo! Você está avançando.";
  if (pct < 0.75) return "Mais da metade! 💪 Vai fundo.";
  if (pct < 1) return "Quase lá! Só mais um pouquinho.";
  return "Dia concluído! 🎉 Parabéns.";
}

// Partículas de confetti simples
function Confetti() {
  const COLORS = ["#4F8EF7", "#34C759", "#FF9500", "#FF3B30", "#AF52DE", "#FF2D55"];
  const particles = Array.from({ length: 32 }, (_, i) => ({
    id: i,
    color: COLORS[i % COLORS.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.6}s`,
    dur: `${0.8 + Math.random() * 0.6}s`,
    size: `${6 + Math.random() * 6}px`,
    rotate: `${Math.random() * 360}deg`,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${p.rotate})`,
            animationDelay: p.delay,
            animationDuration: p.dur,
          }}
        />
      ))}
    </div>
  );
}

function DaySummary({ total, done }) {
  const prevDone = useRef(done);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (total > 0 && done === total && prevDone.current < done) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1800);
    }
    prevDone.current = done;
  }, [done, total]);

  if (total === 0) return null;

  const pct = done / total;
  const allDone = done === total;

  return (
    <div className={[
      "relative mb-6 rounded-xl px-4 py-3 border transition-colors",
      allDone
        ? "bg-success/10 border-success/30"
        : "bg-card border-border",
    ].join(" ")}>
      {showConfetti && <Confetti />}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-secondary">
          {done} de {total} concluída{total !== 1 ? "s" : ""}
        </span>
        <span className={["text-xs font-semibold tabular-nums", allDone ? "text-success" : "text-primary"].join(" ")}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={["h-full rounded-full transition-all duration-500", allDone ? "bg-success" : "bg-primary"].join(" ")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className={["text-[11px] mt-1.5", allDone ? "text-success font-medium" : "text-text-secondary"].join(" ")}>
        {motivationalMsg(pct)}
      </p>
    </div>
  );
}

export function Today() {
  const { getToday, getCompletedToday } = useTaskStore();
  const { urgentFilter, toggleUrgentFilter } = useUiStore();
  const [selectedTask, setSelectedTask] = useState(null);

  const todayDate = localDateStr();
  const allTasks = getToday();
  const overdueTasks = allTasks.filter((t) => t.scheduled_date < todayDate);
  const todayTasks = allTasks.filter((t) => t.scheduled_date >= todayDate);
  const completed = getCompletedToday();

  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const total = todayTasks.length + completed.length;

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        <div className="hidden md:flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-text-main">Hoje</h1>
          <span className="text-sm text-text-secondary font-normal">— {greeting}</span>
          <button
            onClick={toggleUrgentFilter}
            title={urgentFilter ? "Ver todas as tarefas" : "Filtrar só urgentes"}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              urgentFilter
                ? "bg-danger text-white shadow-sm"
                : "bg-danger/10 text-danger hover:bg-danger/20",
            ].join(" ")}
          >
            <span className={urgentFilter ? "animate-pulse" : ""}>🔴</span>
            {urgentFilter ? "Só urgentes" : "Urgentes"}
          </button>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-text-secondary capitalize">{todayLabel}</p>
          <button
            onClick={toggleUrgentFilter}
            className={[
              "md:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              urgentFilter
                ? "bg-danger text-white shadow-sm"
                : "bg-danger/10 text-danger",
            ].join(" ")}
          >
            <span className={urgentFilter ? "animate-pulse" : ""}>🔴</span>
            {urgentFilter ? "Só urgentes" : "Urgentes"}
          </button>
        </div>
        <DaySummary total={total} done={completed.length} />
        <FollowUpPanel onTaskClick={setSelectedTask} />
        <TimedTaskList
          tasks={todayTasks}
          overdueTasks={overdueTasks}
          completedTasks={completed}
          defaultFields={{ scheduled_date: todayDate }}
          onTaskClick={setSelectedTask}
        />
      </div>
      {selectedTask && (
        <TaskDetail
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
