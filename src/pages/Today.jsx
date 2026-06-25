import { useState } from "react";
import { TimedTaskList } from "../components/tasks/TimedTaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { useTaskStore } from "../store/taskStore";

// Data local (evita bug de timezone UTC vs BR)
function localDateStr() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function Today() {
  const { getToday, getCompletedToday } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);

  const todayDate = localDateStr();
  const allTasks = getToday();

  // Separa atrasadas (dias anteriores) das tarefas de hoje
  const overdueTasks = allTasks.filter((t) => t.scheduled_date < todayDate);
  const todayTasks = allTasks.filter((t) => t.scheduled_date >= todayDate);
  const completed = getCompletedToday();

  const todayLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-8 py-8">
        <h1 className="text-2xl font-semibold text-text-main mb-1">Hoje</h1>
        <p className="text-sm text-text-secondary mb-6 capitalize">{todayLabel}</p>
        <TimedTaskList
          tasks={todayTasks}
          overdueTasks={overdueTasks}
          completedTasks={completed}
          defaultFields={{ scheduled_date: todayDate }}
          onTaskClick={setSelectedTask}
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
