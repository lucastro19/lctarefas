import { useState } from "react";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { SortBar, useSortedTasks } from "../components/tasks/SortBar";
import { useTaskStore } from "../store/taskStore";
import { useUiStore } from "../store/uiStore";

export function Inbox() {
  const { getInbox, getCompletedInbox } = useTaskStore();
  const { urgentFilter, toggleUrgentFilter } = useUiStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const { sorted: tasks, sort, setSort } = useSortedTasks(getInbox());
  const completed = getCompletedInbox();

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="hidden md:flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-text-main">Inbox</h1>
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
          <p className="text-sm text-text-secondary">
            {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"}
          </p>
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
        <SortBar sort={sort} setSort={setSort} />
        <TaskList
          tasks={tasks}
          completedTasks={completed}
          onTaskClick={setSelectedTask}
          emptyMessage="Inbox vazio — tudo em ordem por aqui."
          emptyIcon="📥"
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
