import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTagStore } from "../store/tagStore";
import { useTaskStore } from "../store/taskStore";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";

export function TagPage() {
  const { id } = useParams();
  const { tags, fetchTagTasks } = useTagStore();
  const { tasks } = useTaskStore();
  const [taskIds, setTaskIds] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const tag = tags.find((t) => t.id === id);

  useEffect(() => {
    setTaskIds(null);
    fetchTagTasks(id).then(setTaskIds);
  }, [id]);

  if (!tag) return null;
  if (taskIds === null) return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
        <h1 className="text-2xl font-semibold text-text-main">{tag.name}</h1>
      </div>
      <p className="text-sm text-text-secondary">Carregando…</p>
    </div>
  );

  const active = tasks.filter(
    (t) => taskIds.includes(t.id) && !t.completed_at && !t.deleted_at && !t.archived_at
  );
  const completed = tasks.filter(
    (t) => taskIds.includes(t.id) && !!t.completed_at && !t.deleted_at
  );

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
          <h1 className="text-2xl font-semibold text-text-main">{tag.name}</h1>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          {active.length} tarefa{active.length !== 1 ? "s" : ""} ativa{active.length !== 1 ? "s" : ""}
        </p>
        <TaskList
          tasks={active}
          completedTasks={completed}
          onTaskClick={setSelectedTask}
          emptyMessage="Nenhuma tarefa ativa com esta tag."
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
