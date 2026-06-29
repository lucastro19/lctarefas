import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAreaStore } from "../store/areaStore";
import { useTaskStore } from "../store/taskStore";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";

export function ProjectPage() {
  const { id } = useParams();
  const { projects, areas } = useAreaStore();
  const { getByProject, getCompletedByProject } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);

  const project = projects.find((p) => p.id === id);
  const area = areas.find((a) => a.id === project?.area_id);
  const tasks = getByProject(id);
  const completed = getCompletedByProject(id);

  if (!project) return <div className="p-8 text-text-secondary text-sm">Projeto não encontrado.</div>;

  const total = tasks.length + completed.length;
  const progress = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <div className="mb-6">
          {area && (
            <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area.color }} />
              {area.name}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
            <h1 className="text-2xl font-semibold text-text-main">{project.name}</h1>
          </div>

          {total > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary">{progress}%</span>
            </div>
          )}

          {project.deadline && (
            <p className="text-xs text-text-secondary mt-2">
              🚨 Prazo: {new Date(project.deadline + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        <TaskList
          tasks={tasks}
          completedTasks={completed}
          defaultFields={{ project_id: id, area_id: project.area_id }}
          onTaskClick={setSelectedTask}
          emptyMessage="Nenhuma tarefa neste projeto."
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
