import { useState } from "react";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { useTaskStore } from "../store/taskStore";

export function Inbox() {
  const { getInbox, getCompletedInbox } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const tasks = getInbox();
  const completed = getCompletedInbox();

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-8 py-8">
        <h1 className="text-2xl font-semibold text-text-main mb-1">Inbox</h1>
        <p className="text-sm text-text-secondary mb-6">
          {tasks.length} {tasks.length === 1 ? "tarefa" : "tarefas"}
        </p>
        <TaskList
          tasks={tasks}
          completedTasks={completed}
          onTaskClick={setSelectedTask}
          emptyMessage="Inbox vazio. Capture uma nova tarefa abaixo."
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
