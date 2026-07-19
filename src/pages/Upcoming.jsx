import { useState, useEffect } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "../components/tasks/TaskCard";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { NewTaskInput } from "../components/tasks/NewTaskInput";
import { BulkActionBar } from "../components/tasks/BulkActionBar";
import { useTaskStore } from "../store/taskStore";
import { useSelectionStore } from "../store/selectionStore";
import { useUiStore } from "../store/uiStore";

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseDateLocal(dateStr) {
  return new Date(dateStr + "T12:00:00");
}

export function Upcoming() {
  const { getUpcoming, subtasks, fetchSubtasks } = useTaskStore();
  const { selectedIds, selectAll, clearAll } = useSelectionStore();
  const { urgentFilter, toggleUrgentFilter } = useUiStore();
  const [selectedTask, setSelectedTask] = useState(null);

  const allTasks = getUpcoming();
  const tasks = urgentFilter ? allTasks.filter((t) => t.is_urgent) : allTasks;
  const todayStr = localDateStr();
  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(t.id));

  useEffect(() => {
    allTasks.forEach((t) => { if (!subtasks[t.id]) fetchSubtasks(t.id); });
  }, [allTasks.length]);

  // Group tasks by individual date
  const groups = tasks.reduce((acc, task) => {
    const key = task.scheduled_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const sortedDays = Object.keys(groups).sort();

  // Month headers
  const monthHeaderBefore = new Set();
  let lastMonth = null;
  for (const day of sortedDays) {
    const d = parseDateLocal(day);
    const m = d.getMonth();
    if (m !== lastMonth) {
      monthHeaderBefore.add(day);
      lastMonth = m;
    }
  }

  return (
    <>
      <div className="flex h-full" onClick={() => setSelectedTask(null)}>
        <div className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto">

          {/* Header */}
          <div className="hidden md:flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-semibold text-text-main">Em Breve</h1>
            <button
              onClick={(e) => { e.stopPropagation(); toggleUrgentFilter(); }}
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
            {tasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); allSelected ? clearAll() : selectAll(tasks.map((t) => t.id)); }}
                className="ml-auto text-xs text-[#8E8E93] hover:text-primary dark:text-white/40 dark:hover:text-primary transition-colors"
              >
                {allSelected ? "Desmarcar tudo" : "Selecionar tudo"}
              </button>
            )}
          </div>

          {/* Mobile header row */}
          <div className="md:hidden flex items-center justify-between mb-4">
            <button
              onClick={(e) => { e.stopPropagation(); toggleUrgentFilter(); }}
              className={[
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                urgentFilter
                  ? "bg-danger text-white shadow-sm"
                  : "bg-danger/10 text-danger",
              ].join(" ")}
            >
              <span className={urgentFilter ? "animate-pulse" : ""}>🔴</span>
              {urgentFilter ? "Só urgentes" : "Urgentes"}
            </button>
            {tasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); allSelected ? clearAll() : selectAll(tasks.map((t) => t.id)); }}
                className="text-xs text-[#8E8E93] hover:text-primary dark:text-white/40 dark:hover:text-primary transition-colors"
              >
                {allSelected ? "Desmarcar" : "Selecionar tudo"}
              </button>
            )}
          </div>

          {sortedDays.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
              <span className="text-5xl opacity-25">⏰</span>
              <p className="text-sm text-text-secondary">
                {urgentFilter ? "Nenhuma tarefa urgente futura." : "Nenhuma tarefa futura agendada."}
              </p>
            </div>
          )}

          {sortedDays.map((day) => {
            const d = parseDateLocal(day);
            const isToday = day === todayStr;
            const isPast = day < todayStr;
            const dayNum = d.getDate();
            const weekday = WEEKDAYS_SHORT[d.getDay()];
            const monthName = MONTHS[d.getMonth()];
            const hasUrgent = groups[day].some((t) => t.is_urgent);

            return (
              <div key={day}>
                {monthHeaderBefore.has(day) && (
                  <div className="flex items-center gap-3 mb-4 mt-2 first:mt-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary/60">
                      {monthName} {d.getFullYear()}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className="flex gap-4 mb-6">
                  <div className="flex flex-col items-center shrink-0 pt-0.5" style={{ minWidth: 40 }}>
                    <span
                      className={[
                        "text-[28px] font-bold leading-none tabular-nums",
                        isToday
                          ? "text-primary"
                          : isPast
                          ? "text-danger/70"
                          : hasUrgent
                          ? "text-danger"
                          : "text-text-main",
                      ].join(" ")}
                    >
                      {dayNum}
                    </span>
                    <span
                      className={[
                        "text-[10px] font-medium uppercase tracking-wide mt-0.5",
                        isToday ? "text-primary/70" : isPast ? "text-danger/50" : "text-text-secondary/60",
                      ].join(" ")}
                    >
                      {isToday ? "Hoje" : weekday}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
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
                    <div className="mt-1">
                      <NewTaskInput defaultFields={{ scheduled_date: day }} />
                    </div>
                  </div>
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
      <BulkActionBar />
    </>
  );
}
