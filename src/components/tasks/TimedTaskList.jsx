import { useEffect, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { NewTaskInput } from "./NewTaskInput";
import { BulkActionBar } from "./BulkActionBar";
import { useTaskStore } from "../../store/taskStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";

function OverdueSection({ tasks, subtasks, onTaskClick }) {
  const [open, setOpen] = useState(true);
  const sorted = [...tasks].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return (
    <div className="mb-3">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-2 w-full pt-1 pb-2 px-1 text-left"
      >
        <span className="text-sm leading-none">⚠️</span>
        <span className="text-xs font-semibold text-warning uppercase tracking-widest">Atrasadas</span>
        <span className="text-[11px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full leading-none">
          {tasks.length}
        </span>
        <div className="flex-1 h-px bg-warning/20" />
        <span className="text-warning text-[10px] ml-1">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="space-y-1">
          {sorted.map((task) => (
            <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
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

function minutesToStr(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getPeriod(time) {
  if (!time) return "sem-horario";
  const mins = timeToMinutes(time);
  if (mins < 5 * 60) return "noite";
  if (mins < 12 * 60) return "manha";
  if (mins < 18 * 60) return "tarde";
  return "noite";
}

// Horário de início de cada período
const PERIOD_START = { manha: null, tarde: 12 * 60, noite: 18 * 60 }; // manhã usa dayStart

// Dado as tarefas já no período, calcula o próximo slot disponível
function nextSlotInPeriod(periodKey, periodTasks, dayStartStr, defaultDuration) {
  const [sh, sm] = dayStartStr.split(":").map(Number);
  const periodStart = periodKey === "manha" ? sh * 60 + sm : PERIOD_START[periodKey];

  if (periodTasks.length === 0) return minutesToStr(periodStart);

  const sorted = [...periodTasks].sort((a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time));
  const last = sorted[sorted.length - 1];
  const lastStart = timeToMinutes(last.scheduled_time);
  const lastDur = last.duration_minutes ?? defaultDuration;
  return minutesToStr(lastStart + lastDur);
}

const TIMED_PERIODS = [
  { key: "manha", label: "Manhã", icon: "🌅" },
  { key: "tarde", label: "Tarde", icon: "☀️" },
  { key: "noite", label: "Noite", icon: "🌙" },
];

function PeriodSeparator({ icon, label }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-1 px-1">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function FocusGroup({ label, color, tasks, subtasks, onTaskClick }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 pb-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>{label}</span>
        <div className="flex-1 h-px" style={{ backgroundColor: color + "40" }} />
        <span className="text-[10px] font-medium" style={{ color }}>{tasks.length}</span>
      </div>
      <div className="space-y-1">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
        ))}
      </div>
    </div>
  );
}

export function TimedTaskList({ tasks, overdueTasks = [], completedTasks = [], defaultFields = {}, onTaskClick }) {
  const { subtasks, fetchSubtasks } = useTaskStore();
  const { selectedIds, selectAll, clearAll } = useSelectionStore();
  const { focusMode } = useUiStore();
  const { dayStart, defaultDurationMinutes } = useSettingsStore();
  const [showCompleted, setShowCompleted] = useState(false);
  const [showNoPriority, setShowNoPriority] = useState(false);
  const [showNoTime, setShowNoTime] = useState(false);

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(t.id));

  useEffect(() => {
    [...tasks, ...overdueTasks, ...completedTasks].forEach((t) => {
      if (!subtasks[t.id]) fetchSubtasks(t.id);
    });
  }, [tasks, overdueTasks, completedTasks]);

  // ── MODO FOCO ──
  if (focusMode) {
    const highTasks   = tasks.filter((t) => t.priority === "high");
    const mediumTasks = tasks.filter((t) => t.priority === "medium");
    const lowTasks    = tasks.filter((t) => t.priority === "low");
    const noneTasks   = tasks.filter((t) => !t.priority);

    return (
      <>
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4 px-1 py-2 rounded-xl bg-primary/8 border border-primary/20">
            <span className="text-sm">🎯</span>
            <span className="text-xs font-medium text-primary flex-1">Modo Foco — apenas tarefas pendentes</span>
            <span className="text-xs text-text-secondary">{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</span>
          </div>

          {tasks.length === 0 && overdueTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2 select-none">
              <span className="text-5xl opacity-30 mb-1">🎯</span>
              <p className="text-sm text-text-secondary">Tudo em dia! Nenhuma tarefa pendente.</p>
            </div>
          )}

          {overdueTasks.length > 0 && (
            <OverdueSection tasks={overdueTasks} subtasks={subtasks} onTaskClick={onTaskClick} />
          )}

          {highTasks.length > 0 && (
            <FocusGroup label="🔴 Alta prioridade" color="#FF3B30" tasks={highTasks} subtasks={subtasks} onTaskClick={onTaskClick} />
          )}
          {mediumTasks.length > 0 && (
            <FocusGroup label="🟡 Média prioridade" color="#FF9500" tasks={mediumTasks} subtasks={subtasks} onTaskClick={onTaskClick} />
          )}
          {lowTasks.length > 0 && (
            <FocusGroup label="🟢 Baixa prioridade" color="#34C759" tasks={lowTasks} subtasks={subtasks} onTaskClick={onTaskClick} />
          )}

          {noneTasks.length > 0 && (
            <div className="mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowNoPriority((v) => !v); }}
                className="flex items-center gap-2 w-full text-xs text-text-secondary hover:text-text-main py-2 px-1 transition-colors"
              >
                <span>{showNoPriority ? "▾" : "▸"}</span>
                <span>{noneTasks.length} tarefa{noneTasks.length !== 1 ? "s" : ""} sem prioridade</span>
              </button>
              {showNoPriority && (
                <div className="space-y-1 mt-1">
                  {noneTasks.map((task) => (
                    <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
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

  // ── MODO NORMAL — períodos sempre visíveis ──
  const sorted = [...tasks].sort((a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time));

  const grouped = TIMED_PERIODS.reduce((acc, p) => {
    acc[p.key] = sorted.filter((t) => getPeriod(t.scheduled_time) === p.key);
    return acc;
  }, {});
  const noTimeTasks = sorted.filter((t) => getPeriod(t.scheduled_time) === "sem-horario");

  return (
    <>
      <div className="space-y-1">
        {overdueTasks.length > 0 && (
          <OverdueSection tasks={overdueTasks} subtasks={subtasks} onTaskClick={onTaskClick} />
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
          <div className="pb-2" />
        )}

        <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {TIMED_PERIODS.map((period) => {
            const periodTasks = grouped[period.key];
            const nextSlot = nextSlotInPeriod(period.key, periodTasks, dayStart, defaultDurationMinutes);
            return (
              <div key={period.key}>
                <PeriodSeparator icon={period.icon} label={period.label} />
                <div className="space-y-1">
                  {periodTasks.map((task) => (
                    <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
                  ))}
                </div>
                <NewTaskInput
                  defaultFields={{ ...defaultFields, scheduled_time: nextSlot }}
                />
              </div>
            );
          })}
        </SortableContext>

        {/* Tarefas sem horário (colapsável) */}
        {noTimeTasks.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => setShowNoTime((v) => !v)}
              className="flex items-center gap-2 text-xs text-[#8E8E93] hover:text-text-main dark:text-white/40 dark:hover:text-white/80 py-2 px-1 w-full transition-colors font-medium"
            >
              <span>{showNoTime ? "▾" : "▸"}</span>
              <span>📋 {noTimeTasks.length} sem horário</span>
            </button>
            {showNoTime && (
              <div className="space-y-1 mt-1">
                {noTimeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
                ))}
              </div>
            )}
          </div>
        )}

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
                  <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
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
