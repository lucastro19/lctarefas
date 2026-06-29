import { useEffect, useState } from "react";
import { useAreaStore } from "../store/areaStore";
import { useTaskStore } from "../store/taskStore";

function Breadcrumb({ parts }) {
  return (
    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-text-secondary/30">›</span>}
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            {part.color && (
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: part.color }} />
            )}
            {part.name}
          </span>
        </span>
      ))}
    </div>
  );
}

function TrashItem({ icon, label, breadcrumb, onRestore, onDelete }) {
  return (
    <div className="flex items-start gap-3 bg-card border border-border rounded-card px-4 py-3 group">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-secondary line-through truncate">{label}</p>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb parts={breadcrumb} />}
      </div>
      <div className="flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onRestore} className="text-xs text-primary hover:underline">
          Restaurar
        </button>
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-danger hover:underline">
            Excluir
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-3">{title}</p>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function Trash() {
  const { fetchTrashData, restoreArea, permanentDeleteArea, restoreProject, permanentDeleteProject, fetchAll } = useAreaStore();
  const { fetchTasks, restoreTask, permanentDeleteTask } = useTaskStore();

  const [deletedAreas, setDeletedAreas] = useState([]);
  const [deletedProjects, setDeletedProjects] = useState([]);
  const [deletedTasks, setDeletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emptying, setEmptying] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await fetchTrashData();
    setDeletedAreas(result.deletedAreas);
    setDeletedProjects(result.deletedProjects);
    setDeletedTasks(result.deletedTasks);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const total = deletedAreas.length + deletedProjects.length + deletedTasks.length;

  const handleRestoreArea = async (id) => {
    await restoreArea(id);
    await fetchAll();
    await fetchTasks();
    setDeletedAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDeleteArea = async (id, name) => {
    if (!confirm(`Excluir "${name}" permanentemente?\n\nTodos os projetos e tarefas dentro serão apagados para sempre.`)) return;
    await permanentDeleteArea(id);
    setDeletedAreas((prev) => prev.filter((a) => a.id !== id));
  };

  const handleRestoreProject = async (id) => {
    await restoreProject(id);
    await fetchAll();
    await fetchTasks();
    setDeletedProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleDeleteProject = async (id, name) => {
    if (!confirm(`Excluir "${name}" permanentemente?\n\nTodas as tarefas dentro serão apagadas para sempre.`)) return;
    await permanentDeleteProject(id);
    setDeletedProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleRestoreTask = async (task) => {
    await restoreTask(task.id);
    await fetchTasks();
    setDeletedTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  const handleDeleteTask = async (id, title) => {
    if (!confirm(`Excluir "${title}" permanentemente?\n\nEsta ação não pode ser desfeita.`)) return;
    await permanentDeleteTask(id);
    setDeletedTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleEmptyTrash = async () => {
    if (total === 0) return;
    if (!confirm(`Esvaziar a lixeira permanentemente?\n\n${total} item${total !== 1 ? "ns" : ""} será${total !== 1 ? "ão" : ""} excluído${total !== 1 ? "s" : ""} para sempre. Esta ação não pode ser desfeita.`)) return;
    setEmptying(true);
    await Promise.all([
      ...deletedTasks.map((t) => permanentDeleteTask(t.id)),
      ...deletedAreas.map((a) => permanentDeleteArea(a.id)),
      ...deletedProjects.map((p) => permanentDeleteProject(p.id)),
    ]);
    setDeletedTasks([]);
    setDeletedAreas([]);
    setDeletedProjects([]);
    await fetchAll();
    setEmptying(false);
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-main mb-1">Lixeira</h1>
          <p className="text-sm text-text-secondary">
            {loading ? "Carregando…" : `${total} item${total !== 1 ? "s" : ""} nos últimos 30 dias`}
          </p>
        </div>
        {!loading && total > 0 && (
          <button
            onClick={handleEmptyTrash}
            disabled={emptying}
            className="text-sm text-danger border border-danger/30 hover:bg-danger/5 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0 mt-1"
          >
            {emptying ? "Esvaziando…" : "Esvaziar lixeira"}
          </button>
        )}
      </div>

      {!loading && total === 0 && (
        <p className="text-sm text-text-secondary text-center py-12">Lixeira vazia. 🗑️</p>
      )}

      {deletedAreas.length > 0 && (
        <Section title="Áreas">
          {deletedAreas.map((area) => (
            <TrashItem
              key={area.id}
              icon="📁"
              label={area.name}
              onRestore={() => handleRestoreArea(area.id)}
              onDelete={() => handleDeleteArea(area.id, area.name)}
            />
          ))}
        </Section>
      )}

      {deletedProjects.length > 0 && (
        <Section title="Projetos">
          {deletedProjects.map((project) => (
            <TrashItem
              key={project.id}
              icon="📋"
              label={project.name}
              breadcrumb={project.areas ? [{ name: project.areas.name, color: project.areas.color }] : []}
              onRestore={() => handleRestoreProject(project.id)}
              onDelete={() => handleDeleteProject(project.id, project.name)}
            />
          ))}
        </Section>
      )}

      {deletedTasks.length > 0 && (
        <Section title="Tarefas">
          {deletedTasks.map((task) => {
            const breadcrumb = [];
            const area = task.areas ?? task.projects?.areas;
            const project = task.projects;
            if (area) breadcrumb.push({ name: area.name, color: area.color });
            if (project) breadcrumb.push({ name: project.name, color: project.color });
            return (
              <TrashItem
                key={task.id}
                icon="☑️"
                label={task.title}
                breadcrumb={breadcrumb}
                onRestore={() => handleRestoreTask(task)}
                onDelete={() => handleDeleteTask(task.id, task.title)}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}
