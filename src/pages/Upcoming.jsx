import { useState, useEffect } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TaskCard } from "../components/tasks/TaskCard";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { NewTaskInput } from "../components/tasks/NewTaskInput";
import { useTaskStore } from "../store/taskStore";

function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatGroupLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === localDateStr(tomorrow)) return "Amanhã";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export function Upcoming() {
  const { getUpcoming, subtasks, fetchSubtasks } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const tasks = getUpcoming();

  useEffect(() => {
    tasks.forEach((t) => { if (!subtasks[t.id]) fetchSubtasks(t.id); });
  }, [tasks.length]);

  const groups = tasks.reduce((acc, task) => {
    const day = task.scheduled_date;
    if (!acc[day]) acc[day] = [];
    acc[day].push(task);
    return acc;
  }, {});

  const sortedDays = Object.keys(groups).sort();

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <h1 className="text-2xl font-semibold text-text-main mb-1">Em Breve</h1>
        <p className="text-sm text-text-secondary mb-6">Próximos 7 dias</p>

        {sortedDays.length === 0 && (
          <p className="text-sm text-text-secondary text-center py-8">Sem tarefas nos próximos 7 dias. ⏰</p>
        )}

        {sortedDays.map((day) => (
          <section key={day} className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-2 capitalize">
              {formatGroupLabel(day)}
            </p>
            <SortableContext items={groups[day].map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {groups[day].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    subtasks={subtasks[task.id] ?? []}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </div>
            </SortableContext>
            <div className="mt-1">
              <NewTaskInput defaultFields={{ scheduled_date: day }} />
            </div>
          </section>
        ))}
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
