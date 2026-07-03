import { useState, useEffect } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "../components/tasks/TaskCard";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { NewTaskInput } from "../components/tasks/NewTaskInput";
import { useTaskStore } from "../store/taskStore";

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatGroupLabel(dateStr, windowDays) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);

  if (dateStr === localDateStr(tomorrow)) return "Amanhã";

  // Em janelas maiores, agrupa por semana
  if (windowDays > 7) {
    const weekOf = new Date(d);
    weekOf.setDate(d.getDate() - d.getDay() + 1); // segunda-feira da semana
    const weekEnd = new Date(weekOf);
    weekEnd.setDate(weekOf.getDate() + 6);
    const label = weekOf.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    const labelEnd = weekEnd.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    return `Semana de ${label} – ${labelEnd}`;
  }

  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

const WINDOWS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "3 meses", days: 90 },
];

export function Upcoming() {
  const { getUpcoming, subtasks, fetchSubtasks } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const [windowDays, setWindowDays] = useState(7);
  const tasks = getUpcoming(windowDays);

  useEffect(() => {
    tasks.forEach((t) => { if (!subtasks[t.id]) fetchSubtasks(t.id); });
  }, [tasks.length, windowDays]);

  // Para janelas > 7 dias, agrupa por semana (início da semana ISO)
  const groupKey = (task) => {
    if (windowDays <= 7) return task.scheduled_date;
    const d = new Date(task.scheduled_date + "T12:00:00");
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda
    return localDateStr(mon);
  };

  const groups = tasks.reduce((acc, task) => {
    const key = groupKey(task);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const sortedDays = Object.keys(groups).sort();

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center justify-between mb-1 gap-4">
          <h1 className="hidden md:block text-2xl font-semibold text-text-main">Em Breve</h1>
          {/* Filtro de janela */}
          <div className="flex items-center gap-1 shrink-0">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                onClick={(e) => { e.stopPropagation(); setWindowDays(w.days); }}
                className={[
                  "text-xs px-2.5 py-1 rounded-lg border transition-colors font-medium",
                  windowDays === w.days
                    ? "border-primary bg-primary text-white"
                    : "border-border text-text-secondary hover:border-primary/40 hover:text-primary",
                ].join(" ")}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          {tasks.length === 0
            ? "Sem tarefas neste período"
            : `${tasks.length} tarefa${tasks.length !== 1 ? "s" : ""} nos próximos ${windowDays} dias`}
        </p>

        {sortedDays.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">Sem tarefas nos próximos {windowDays} dias. ⏰</p>
        )}

        {sortedDays.map((day) => (
          <section key={day} className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2 capitalize">
              {windowDays <= 7
                ? formatGroupLabel(day, windowDays)
                : (() => {
                    const d = new Date(day + "T12:00:00");
                    const end = new Date(d);
                    end.setDate(d.getDate() + 6);
                    const s = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
                    const e2 = end.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
                    return `Semana de ${s} – ${e2}`;
                  })()
              }
              <span className="font-normal normal-case tracking-normal ml-1 text-text-secondary/60">
                · {groups[day].length}
              </span>
            </p>
            <SortableContext items={groups[day].map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {groups[day].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasks[task.id] ?? []}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </div>
            </SortableContext>
            {windowDays <= 7 && (
              <div className="mt-1">
                <NewTaskInput defaultFields={{ scheduled_date: groups[day][0]?.scheduled_date ?? day }} />
              </div>
            )}
          </section>
        ))}
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
