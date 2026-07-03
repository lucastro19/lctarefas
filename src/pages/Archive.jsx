import { useEffect, useState } from "react";
import { useAreaStore } from "../store/areaStore";
import { useTaskStore } from "../store/taskStore";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export function Archive() {
  const { fetchArchived, unarchiveArea, unarchiveProject, fetchAll } = useAreaStore();
  const { getArchived, unarchiveTask, fetchTasks } = useTaskStore();
  const [archivedAreas, setArchivedAreas] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await fetchArchived();
    setArchivedAreas(result.archivedAreas);
    setArchivedProjects(result.archivedProjects);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const archivedTasks = getArchived();

  const handleUnarchiveArea = async (id) => {
    await unarchiveArea(id);
    await fetchAll();
    setArchivedAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUnarchiveProject = async (id) => {
    await unarchiveProject(id);
    await fetchAll();
    setArchivedProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUnarchiveTask = async (id) => {
    await unarchiveTask(id);
    await fetchTasks();
  };

  const total = archivedAreas.length + archivedProjects.length + archivedTasks.length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <h1 className="hidden md:block text-2xl font-semibold text-text-main mb-1">Arquivo</h1>
      <p className="text-sm text-text-secondary mb-6">
        {loading ? "Carregando…" : `${total} item${total !== 1 ? "s" : ""} arquivado${total !== 1 ? "s" : ""}`}
      </p>

      {!loading && total === 0 && (
        <p className="text-sm text-text-secondary text-center py-12">Nenhum item arquivado. 📦</p>
      )}

      {archivedAreas.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Áreas</p>
          <div className="space-y-1">
            {archivedAreas.map((area) => (
              <div
                key={area.id}
                className="flex items-center gap-3 bg-card border border-border rounded-card px-4 py-3 group"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                <span className="flex-1 text-sm text-text-secondary">{area.name}</span>
                <span className="text-xs text-text-secondary/50 mr-2 hidden group-hover:block">
                  arquivada em {formatDate(area.archived_at)}
                </span>
                <button
                  onClick={() => handleUnarchiveArea(area.id)}
                  className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Desarquivar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {archivedProjects.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Projetos</p>
          <div className="space-y-1">
            {archivedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3 bg-card border border-border rounded-card px-4 py-3 group"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary">{project.name}</p>
                  {project.areas && (
                    <p className="text-xs text-text-secondary/50 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.areas.color }} />
                      {project.areas.name}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-secondary/50 mr-2 hidden group-hover:block">
                  arquivado em {formatDate(project.archived_at)}
                </span>
                <button
                  onClick={() => handleUnarchiveProject(project.id)}
                  className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  Desarquivar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {archivedTasks.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">Tarefas</p>
          <div className="space-y-1">
            {archivedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 bg-card border border-border rounded-card px-4 py-3 group"
              >
                <span className="text-base shrink-0">☑️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary truncate">{task.title}</p>
                </div>
                <span className="text-xs text-text-secondary/50 mr-2 hidden group-hover:block">
                  arquivada em {formatDate(task.archived_at)}
                </span>
                <button
                  onClick={() => handleUnarchiveTask(task.id)}
                  className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  Desarquivar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
