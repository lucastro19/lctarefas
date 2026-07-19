import { useEffect, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { NewTaskInput } from "./NewTaskInput";
import { BulkActionBar } from "./BulkActionBar";
import { useTaskStore } from "../../store/taskStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { strToMins, minsToStr, getPeriod, nextSlotInPeriod } from "../../utils/timeSlots";

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
  return strToMins(time);
}

// nextSlotInPeriod aqui retorna só a string (compatibilidade com uso existente)
function nextSlotInPeriodStr(periodKey, periodTasks, settings, defaultDuration) {
  const result = nextSlotInPeriod(periodKey, periodTasks, settings, defaultDuration);
  return result.time;
}

const TIMED_PERIODS = [
  { key: "manha", label: "Manhã", icon: "🌅" },
  { key: "tarde", label: "Tarde", icon: "☀️" },
  { key: "noite", label: "Noite", icon: "🌙" },
];

function PeriodSeparator({ icon, label, count = 0 }) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-1 px-1">
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest">{label}</span>
      {count > 0 && (
        <span className="text-[10px] font-medium text-text-secondary/60 tabular-nums bg-border/60 px-1.5 py-0.5 rounded-full leading-none">
          {count}
        </span>
      )}
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
  const { focusMode, urgentFilter, toggleUrgentFilter } = useUiStore();
  const settings = useSettingsStore();
  const { defaultDurationMinutes } = settings;
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

  // ── FILTRO URGENTE ──
  if (urgentFilter) {
    const urgentTasks = tasks.filter((t) => t.is_urgent);
    const allUrgent = [...overdueTasks.filter((t) => t.is_urgent), ...urgentTasks];
    return (
      <>
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-4 px-1 py-2 rounded-xl bg-danger/8 border border-danger/25">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
            </span>
            <span className="text-xs font-medium text-danger flex-1">Filtro urgente — mostrando só tarefas urgentes</span>
            <button
              onClick={toggleUrgentFilter}
              className="text-[10px] text-danger/70 hover:text-danger underline underline-offset-2 transition-colors"
            >
              Ver tudo
            </button>
          </div>

          {allUrgent.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2 select-none">
              <span className="text-5xl opacity-30 mb-1">✅</span>
              <p className="text-sm text-text-secondary">Nenhuma tarefa urgente pendente.</p>
            </div>
          )}

          {allUrgent.map((task) => (
            <TaskCard key={task.id} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
          ))}
        </div>
        <BulkActionBar />
      </>
    );
  }

  // ── MODO NORMAL — períodos sempre visíveis ──
  const urgentTodayTasks = tasks.filter((t) => t.is_urgent);
  const sorted = [...tasks].sort((a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time));

  const grouped = TIMED_PERIODS.reduce((acc, p) => {
    acc[p.key] = sorted.filter((t) => {
      const period = getPeriod(t.scheduled_time, settings);
      // Tarefas no almoço definidas manualmente aparecem em Manhã (logo antes da Tarde)
      if (p.key === "manha") return period === "manha" || period === "almoco";
      return period === p.key;
    });
    return acc;
  }, {});
  const noTimeTasks = sorted.filter((t) => getPeriod(t.scheduled_time, settings) === "sem-horario");

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
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2 select-none">
            <span className="text-5xl opacity-25 mb-1">☀️</span>
            <p className="text-sm font-medium text-text-main">Dia livre!</p>
            <p className="text-xs text-text-secondary max-w-xs">Nenhuma tarefa agendada para hoje. Use os blocos abaixo para planejar o seu dia.</p>
          </div>
        )}

        {/* ── RESOLVER PRIMEIRO — tarefas urgentes do dia ── */}
        {urgentTodayTasks.length > 0 && (
          <div className="mb-2 rounded-xl border border-danger/30 bg-danger/5 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-danger/20">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </span>
              <span className="text-[11px] font-semibold text-danger uppercase tracking-widest flex-1">
                Resolver primeiro
              </span>
              <span className="text-[10px] font-medium text-danger/70 bg-danger/10 px-1.5 py-0.5 rounded-full">
                {urgentTodayTasks.length}
              </span>
            </div>
            <div className="p-1.5 space-y-1">
              {urgentTodayTasks.map((task) => (
                <TaskCard key={`urgent-${task.id}`} task={task} subtasks={subtasks[task.id] ?? []} onClick={() => onTaskClick?.(task)} />
              ))}
            </div>
          </div>
        )}

        <SortableContext items={sorted.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {TIMED_PERIODS.map((period) => {
            const periodTasks = grouped[period.key];
                const nextSlot = nextSlotInPeriodStr(period.key, periodTasks, settings, defaultDurationMinutes);
            return (
              <div key={period.key}>
                <PeriodSeparator icon={period.icon} label={period.label} count={periodTasks.length} />
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
