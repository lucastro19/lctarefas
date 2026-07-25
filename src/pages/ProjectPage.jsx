import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAreaStore } from "../store/areaStore";
import { useTaskStore } from "../store/taskStore";
import { useAuthStore } from "../store/authStore";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";
import { ViewSwitcher } from "../components/tasks/ViewSwitcher";
import { BoardView } from "../components/tasks/BoardView";
import { TimelineView } from "../components/tasks/TimelineView";
import { FilterSortBar } from "../components/tasks/FilterSortBar";
import { useViewMode } from "../hooks/useViewMode";
import { useTaskFilters } from "../hooks/useTaskFilters";
import { recordRecentVisit } from "../utils/recentVisits";

export function ProjectPage() {
  const { id } = useParams();
  const { projects, areas } = useAreaStore();
  const { getByProject, getCompletedByProject } = useTaskStore();
  const { user } = useAuthStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode] = useViewMode(`lc_view_project_${id}`);

  const project = projects.find((p) => p.id === id);
  const area = areas.find((a) => a.id === project?.area_id);
  const tasks = getByProject(id);
  const completed = getCompletedByProject(id);

  useEffect(() => {
    if (project) recordRecentVisit(user?.id, { type: "project", id, label: project.name, icon: "📁", to: `/project/${id}` });
  }, [project, id, user?.id]);

  const {
    filtered, people, types, personFilter, setPersonFilter, typeFilter, setTypeFilter,
    lateOnly, setLateOnly, sortBy, setSortBy, groupBy, setGroupBy,
    isMineActive, toggleMine, savedViews, saveCurrentView, applyView, deleteView,
  } = useTaskFilters(tasks, `project_${id}`);

  if (!project) return <div className="p-8 text-text-secondary text-sm">Projeto não encontrado.</div>;

  const total = tasks.length + completed.length;
  const progress = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
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
              <div className="mt-3 flex items-center gap-3 max-w-xs">
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
          <ViewSwitcher mode={viewMode} onChange={setViewMode} />
        </div>

        <FilterSortBar
          people={people} types={types}
          personFilter={personFilter} setPersonFilter={setPersonFilter}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          lateOnly={lateOnly} setLateOnly={setLateOnly}
          sortBy={sortBy} setSortBy={setSortBy}
          groupBy={groupBy} setGroupBy={setGroupBy}
          showGroupBy={viewMode === "board"}
          isMineActive={isMineActive} toggleMine={toggleMine}
          savedViews={savedViews} saveCurrentView={saveCurrentView} applyView={applyView} deleteView={deleteView}
        />

        {viewMode === "board" ? (
          <BoardView tasks={filtered} onTaskClick={setSelectedTask} groupBy={groupBy} personLabel={(pid) => people.find((p) => p.id === pid)?.label ?? "Alguém"} types={types} />
        ) : viewMode === "timeline" ? (
          <TimelineView tasks={filtered} onTaskClick={setSelectedTask} />
        ) : (
          <TaskList
            tasks={filtered}
            completedTasks={completed}
            defaultFields={{ project_id: id, area_id: project.area_id }}
            onTaskClick={setSelectedTask}
            emptyMessage="Nenhuma tarefa neste projeto."
          />
        )}
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
