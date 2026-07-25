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

export function AreaPage() {
  const { id } = useParams();
  const { areas, getProjectsByArea } = useAreaStore();
  const { getByArea, getByProject, getCompletedByArea, getCompletedByProject, tasks: allTasks } = useTaskStore();
  const { user } = useAuthStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);

  const area = areas.find((a) => a.id === id);
  const areaProjects = getProjectsByArea(id);

  useEffect(() => {
    if (area) recordRecentVisit(user?.id, { type: "area", id, label: area.name, icon: "📁", to: `/area/${id}` });
  }, [area, id, user?.id]);

  const viewKey = `lc_view_${activeProjectId ? `project_${activeProjectId}` : `area_${id}`}`;
  const [viewMode, setViewMode] = useViewMode(viewKey);

  const tasks = activeProjectId ? getByProject(activeProjectId) : getByArea(id);
  const completed = activeProjectId ? getCompletedByProject(activeProjectId) : getCompletedByArea(id);
  const defaultFields = activeProjectId
    ? { area_id: id, project_id: activeProjectId }
    : { area_id: id };

  const {
    filtered, people, types, personFilter, setPersonFilter, typeFilter, setTypeFilter,
    lateOnly, setLateOnly, sortBy, setSortBy, groupBy, setGroupBy,
    isMineActive, toggleMine, savedViews, saveCurrentView, applyView, deleteView,
  } = useTaskFilters(tasks, activeProjectId ? `project_${activeProjectId}` : `area_${id}`);

  if (!area) return <div className="p-8 text-text-secondary text-sm">Área não encontrada.</div>;

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {/* Area header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: area.color }} />
            <h1 className="text-2xl font-semibold text-text-main">{area.name}</h1>
          </div>
          <ViewSwitcher mode={viewMode} onChange={setViewMode} />
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
            {areaProjects.map((p) => {
              const pCount = allTasks.filter(
                (t) => t.project_id === p.id && !t.completed_at && !t.deleted_at && !t.archived_at
              ).length;
              return (
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
                  {pCount > 0 && (
                    <span className={[
                      "text-[10px] font-bold tabular-nums px-1 py-0.5 rounded-full leading-none",
                      activeProjectId === p.id ? "bg-white/20 text-white" : "bg-border text-text-secondary",
                    ].join(" ")}>
                      {pCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

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
          <BoardView tasks={filtered} onTaskClick={setSelectedTask} groupBy={groupBy} personLabel={(id) => people.find((p) => p.id === id)?.label ?? "Alguém"} types={types} />
        ) : viewMode === "timeline" ? (
          <TimelineView tasks={filtered} onTaskClick={setSelectedTask} />
        ) : (
          <TaskList
            tasks={filtered}
            completedTasks={completed}
            defaultFields={defaultFields}
            onTaskClick={setSelectedTask}
            emptyMessage="Nenhuma tarefa nesta área."
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
