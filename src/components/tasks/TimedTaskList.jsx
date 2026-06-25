import { useEffect, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { NewTaskInput } from "./NewTaskInput";
import { BulkActionBar } from "./BulkActionBar";
import { useTaskStore } from "../../store/taskStore";
import { useSelectionStore } from "../../store/selectionStore";

function OverdueSection({ tasks, subtasks, onTaskClick }) {
  const [open, setOpen] = useState(true);

  // Ordena da mais antiga para a mais recente
  const sorted = [...tasks].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return (
    <div className="mb-3">
      {/* Cabeçalho recolhível */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-2 w-full pt-1 pb-2 px-1 text-left"
      >
        <span className="text-sm leading-none">⚠️</span>
        <span className="text-xs font-semibold text-warning uppercase tracking-widest">
          Atrasadas
        </span>
        <span className="text-[11px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full leading-none">
          {tasks.length}
        </span>
        <div className="flex-1 h-px bg-warning/20" />
        <span className="text-warning text-[10px] ml-1">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-1">
          {sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              subtasks={subtasks[task.id] ?? []}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function timeToMinutes(time) {
  if (!time) return Infinity;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getPeriod(time) {
  if (!time) return "sem-horario";
  const mins = timeToMinutes(time);
  if (mins < 5 * 60) return "noite";
  if (mins < 12 * 60) return "manha";
  if (mins < 18 * 60) return "tarde";
  return "noite";
}

const PERIODS = [
  { key: "manha", label: "Manhã", icon: "🌅" },
  { key: "tarde", label: "Tarde", icon: "☀️" },
  { key: "noite", label: "Noite", icon: "🌙" },
  { key: "sem-horario", label: "Sem horário", icon: "📋" },
];

function PeriodSeparator({ icon, label }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-1 px-1">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function TimedTaskList({ tasks, overdueTasks = [], completedTasks = [], defaultFields = {}, onTaskClick }) {
  const { subtasks, fetchSubtasks } = useTaskStore();
  const { selectedIds, selectAll, clearAll } = useSelectionStore();
  const [showCompleted, setShowCompleted] = useState(false);

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(t.id));
  const anySelected = selectedIds.length > 0;

  useEffect(() => {
    [...tasks, ...overdueTasks, ...completedTasks].forEach((t) => {
      if (!subtasks[t.id]) fetchSubtasks(t.id);
    });
  }, [tasks, overdueTasks, completedTasks]);

  const sorted = [...tasks].sort((a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time));

  const grouped = PERIODS.reduce((acc, p) => {
    acc[p.key] = sorted.filter((t) => getPeriod(t.scheduled_time) === p.key);
    return acc;
  }, {});

  const activePeriods = PERIODS.filter((p) => grouped[p.key].length > 0);
  const showSeparators = activePeriods.length > 1 || (activePeriods.length === 1 && activePeriods[0].key !== "sem-horario");

  return (
    <>
      <div className="space-y-1">
        {/* Seção de tarefas atrasadas */}
        {overdueTasks.length > 0 && (
          <OverdueSection
            tasks={overdueTasks}
            subtasks={subtasks}
            onTaskClick={onTaskClick}
          />
        )}

        {tasks.length > 0 && (
          <div className="flex items-center justify-end pb-1">
            <button
              onClick={() => allSelected ? clearAll() : selectAll(tasks.map((t) => t.id))}
              className="text-xs text-[#8E8E93] hover:text-primary dark:text-white/40 dark:hover:text-primary transition-colors"
            >
              {allSelected ? "Desmarcar tudo" : "Selecionar tudo"}
            </button>
          </div>
        )}

        {tasks.length === 0 && overdueTasks.length === 0 && completedTasks.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">
            Nenhuma tarefa para hoje. Aproveite o dia! ☀️
          </p>
        )}

        <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {PERIODS.map((period) => {
            const periodTasks = grouped[period.key];
            if (periodTasks.length === 0) return null;
            return (
              <div key={period.key}>
                {showSeparators && (
                  <PeriodSeparator icon={period.icon} label={period.label} />
                )}
                <div className="space-y-1">
                  {periodTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      subtasks={subtasks[task.id] ?? []}
                      onClick={() => onTaskClick?.(task)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </SortableContext>

        <NewTaskInput defaultFields={defaultFields} />

        {completedTasks.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-2 text-xs text-[#8E8E93] hover:text-text-main dark:text-white/40 dark:hover:text-white/80 py-2 px-1 w-full transition-colors font-medium"
            >
              <span>{showCompleted ? "▾" : "▸"}</span>
              <span>{completedTasks.length} concluída{completedTasks.length !== 1 ? "s" : ""}</span>
            </button>

            {showCompleted && (
              <div className="space-y-1 mt-1">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasks[task.id] ?? []}
                    onClick={() => onTaskClick?.(task)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <BulkActionBar />
    </>
  );
}
