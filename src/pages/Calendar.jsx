import { useState } from "react";
import { useTaskStore } from "../store/taskStore";
import { useUiStore } from "../store/uiStore";
import { TaskDetail } from "../components/tasks/TaskDetail";

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // start on Monday
  d.setDate(d.getDate() + diff);
  return d;
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function Calendar() {
  const { tasks } = useTaskStore();
  const { openTask } = useUiStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);

  const today = localDateStr();
  const baseMonday = weekStart(new Date());
  const monday = addDays(baseMonday, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  // Group active tasks by scheduled_date
  const tasksByDay = tasks.reduce((acc, t) => {
    if (!t.scheduled_date || t.deleted_at || t.archived_at) return acc;
    if (!acc[t.scheduled_date]) acc[t.scheduled_date] = [];
    acc[t.scheduled_date].push(t);
    return acc;
  }, {});

  const monthLabel = monday.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 flex flex-col h-full" onClick={() => setSelectedTask(null)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-main capitalize">Calendário</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors text-sm"
          >
            ‹
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors text-sm"
          >
            ›
          </button>
        </div>
      </div>

      <p className="text-sm text-text-secondary mb-4 capitalize">{monthLabel}</p>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {days.map((day, i) => {
          const dateStr = localDateStr(day);
          const isToday = dateStr === today;
          const dayTasks = tasksByDay[dateStr] ?? [];
          const dayNum = day.getDate();

          return (
            <div
              key={dateStr}
              className={[
                "flex flex-col rounded-xl border transition-colors min-h-[120px]",
                isToday ? "border-primary bg-primary/5" : "border-border bg-card",
              ].join(" ")}
            >
              {/* Day header */}
              <div className={["flex flex-col items-center py-2 border-b border-border/50", isToday ? "border-primary/20" : ""].join(" ")}>
                <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">{DAY_LABELS[i]}</span>
                <span className={["text-sm font-semibold mt-0.5", isToday ? "text-primary" : "text-text-main"].join(" ")}>
                  {dayNum}
                </span>
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                {dayTasks.slice(0, 6).map((task) => (
                  <button
                    key={task.id}
                    onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
                    className={[
                      "w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded-md transition-colors truncate",
                      task.completed_at
                        ? "line-through text-text-secondary bg-border/30"
                        : task.is_urgent
                        ? "bg-danger/10 text-danger font-medium"
                        : "bg-primary/10 text-primary hover:bg-primary/20",
                    ].join(" ")}
                  >
                    {task.scheduled_time && (
                      <span className="opacity-60 mr-1">{task.scheduled_time.slice(0, 5)}</span>
                    )}
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 6 && (
                  <p className="text-[10px] text-text-secondary text-center">+{dayTasks.length - 6}</p>
                )}
              </div>
            </div>
          );
        })}
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
