import { useEffect, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { NewTaskInput } from "./NewTaskInput";
import { BulkActionBar } from "./BulkActionBar";
import { useTaskStore } from "../../store/taskStore";
import { useSelectionStore } from "../../store/selectionStore";
import { useUiStore } from "../../store/uiStore";

export function TaskList({ tasks, completedTasks = [], defaultFields = {}, onTaskClick, onCreated, emptyMessage = "Nenhuma tarefa aqui.", emptyIcon = "✅" }) {
  const { subtasks, fetchSubtasks } = useTaskStore();
  const { selectedIds, selectAll, clearAll } = useSelectionStore();
  const { urgentFilter, toggleUrgentFilter } = useUiStore();
  const [showCompleted, setShowCompleted] = useState(false);

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(t.id));

  useEffect(() => {
    [...tasks, ...completedTasks].forEach((t) => {
      if (!subtasks[t.id]) fetchSubtasks(t.id);
    });
  }, [tasks, completedTasks]);

  const visibleTasks = urgentFilter ? tasks.filter((t) => t.is_urgent) : tasks;

  return (
  <>
    <div className="space-y-1">
      {urgentFilter && (
        <div className="flex items-center gap-2 mb-3 px-1 py-2 rounded-xl bg-danger/8 border border-danger/25">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
          </span>
          <span className="text-xs font-medium text-danger flex-1">Filtro urgente ativo</span>
          <button
            onClick={toggleUrgentFilter}
            className="text-[10px] text-danger/70 hover:text-danger underline underline-offset-2 transition-colors"
          >
            Ver tudo
          </button>
        </div>
      )}

      {visibleTasks.length > 0 && (
        <div className="flex items-center justify-end pb-1">
          <button
            onClick={() => allSelected ? clearAll() : selectAll(visibleTasks.map((t) => t.id))}
            className="text-xs text-[#8E8E93] hover:text-primary dark:text-white/40 dark:hover:text-primary transition-colors"
          >
            {allSelected ? "Desmarcar tudo" : "Selecionar tudo"}
          </button>
        </div>
      )}

      {visibleTasks.length === 0 && completedTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 select-none">
          <span className="text-5xl opacity-30 mb-1">{urgentFilter ? "✅" : emptyIcon}</span>
          <p className="text-sm text-text-secondary max-w-xs">
            {urgentFilter ? "Nenhuma tarefa urgente aqui." : emptyMessage}
          </p>
        </div>
      )}

      <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {visibleTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            subtasks={subtasks[task.id] ?? []}
            onClick={() => onTaskClick?.(task)}
          />
        ))}
      </SortableContext>

      <NewTaskInput defaultFields={defaultFields} onCreated={onCreated} />

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
