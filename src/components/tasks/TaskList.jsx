import { useEffect, useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "./TaskCard";
import { NewTaskInput } from "./NewTaskInput";
import { BulkActionBar } from "./BulkActionBar";
import { useTaskStore } from "../../store/taskStore";
import { useSelectionStore } from "../../store/selectionStore";

export function TaskList({ tasks, completedTasks = [], defaultFields = {}, onTaskClick, emptyMessage = "Nenhuma tarefa aqui." }) {
  const { subtasks, fetchSubtasks } = useTaskStore();
  const { selectedIds, selectAll, clearAll } = useSelectionStore();
  const [showCompleted, setShowCompleted] = useState(false);

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds.includes(t.id));
  const anySelected = selectedIds.length > 0;

  useEffect(() => {
    [...tasks, ...completedTasks].forEach((t) => {
      if (!subtasks[t.id]) fetchSubtasks(t.id);
    });
  }, [tasks, completedTasks]);

  return (
  <>
    <div className="space-y-1">
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

      {tasks.length === 0 && completedTasks.length === 0 && (
        <p className="text-sm text-text-secondary text-center py-8">{emptyMessage}</p>
      )}

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            subtasks={subtasks[task.id] ?? []}
            onClick={() => onTaskClick?.(task)}
          />
        ))}
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
