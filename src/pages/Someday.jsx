import { useState } from "react";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { useTaskStore } from "../store/taskStore";

export function Someday() {
  const { getSomeday, getCompletedSomeday } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const tasks = getSomeday();
  const completed = getCompletedSomeday();

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <h1 className="text-2xl font-semibold text-text-main mb-1">Depois</h1>
        <p className="text-sm text-text-secondary mb-6">Ideias e projetos sem urgência</p>
        <TaskList
          tasks={tasks}
          completedTasks={completed}
          defaultFields={{ someday: true }}
          onTaskClick={setSelectedTask}
          emptyMessage="Nenhuma ideia aqui. Adicione tarefas que quer fazer algum dia. 🔮"
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
