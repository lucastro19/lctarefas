import { useState } from "react";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { SortBar, useSortedTasks } from "../components/tasks/SortBar";
import { useTaskStore } from "../store/taskStore";

export function Someday() {
  const { getSomeday, getCompletedSomeday } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const { sorted: tasks, sort, setSort } = useSortedTasks(getSomeday());
  const completed = getCompletedSomeday();

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <h1 className="hidden md:block text-2xl font-semibold text-text-main mb-1">Depois</h1>
        <p className="text-sm text-text-secondary mb-4">Ideias e projetos sem urgência</p>
        <SortBar sort={sort} setSort={setSort} />
        <TaskList
          tasks={tasks}
          completedTasks={completed}
          defaultFields={{ someday: true }}
          onTaskClick={setSelectedTask}
          emptyMessage="Nenhuma ideia guardada ainda. Adicione o que quer fazer quando tiver tempo."
          emptyIcon="🔮"
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
