import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAreaStore } from "../store/areaStore";
import { useTaskStore } from "../store/taskStore";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";

export function AreaPage() {
  const { id } = useParams();
  const { areas, projects, getProjectsByArea } = useAreaStore();
  const { getByArea, getByProject, getCompletedByArea, getCompletedByProject } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);

  const area = areas.find((a) => a.id === id);
  const areaProjects = getProjectsByArea(id);

  if (!area) return <div className="p-8 text-text-secondary text-sm">Área não encontrada.</div>;

  const tasks = activeProjectId ? getByProject(activeProjectId) : getByArea(id);
  const completed = activeProjectId ? getCompletedByProject(activeProjectId) : getCompletedByArea(id);
  const defaultFields = activeProjectId
    ? { area_id: id, project_id: activeProjectId }
    : { area_id: id };

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Area header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: area.color }} />
          <h1 className="text-2xl font-semibold text-text-main">{area.name}</h1>
        </div>

        {/* Project tabs */}
        {areaProjects.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveProjectId(null)}
              className={[
                "text-sm px-3 py-1.5 rounded-lg shrink-0 transition-colors",
                !activeProjectId ? "bg-primary text-white" : "bg-card border border-border text-text-secondary hover:text-text-main",
              ].join(" ")}
            >
              Tarefas avulsas
            </button>
            {areaProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className={[
                  "text-sm px-3 py-1.5 rounded-lg shrink-0 transition-colors flex items-center gap-1.5",
                  activeProjectId === p.id ? "bg-primary text-white" : "bg-card border border-border text-text-secondary hover:text-text-main",
                ].join(" ")}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeProjectId === p.id ? "white" : p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <TaskList
          tasks={tasks}
          completedTasks={completed}
          defaultFields={defaultFields}
          onTaskClick={setSelectedTask}
          emptyMessage="Nenhuma tarefa nesta área."
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
