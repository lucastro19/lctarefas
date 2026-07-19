import { useAuthStore } from "../store/authStore";
import { useTaskStore } from "../store/taskStore";
import { useAreaStore } from "../store/areaStore";

const LIMITS = {
  free:  { tasks: 150, areas: 3, projects: 10, tags: 10 },
  pro:   { tasks: Infinity, areas: Infinity, projects: Infinity, tags: Infinity },
  admin: { tasks: Infinity, areas: Infinity, projects: Infinity, tags: Infinity },
};

export function usePlanLimits() {
  const profile = useAuthStore((s) => s.profile);
  const tasks   = useTaskStore((s) => s.tasks);
  const areas   = useAreaStore((s) => s.areas);
  const projects = useAreaStore((s) => s.projects);

  const plan   = profile?.role ?? "free";
  const isPro  = plan === "pro" || plan === "admin";
  const isAdmin = plan === "admin";
  const limits = LIMITS[plan] ?? LIMITS.free;

  const activeTasks   = tasks.filter((t) => !t.completed_at && !t.deleted_at).length;
  const activeAreas   = (areas ?? []).filter((a) => !a.deleted_at).length;
  const activeProjects = (projects ?? []).filter((p) => !p.deleted_at).length;

  return {
    plan,
    isPro,
    isAdmin,
    limits,
    usage: {
      tasks:    activeTasks,
      areas:    activeAreas,
      projects: activeProjects,
    },
    canAddTask:    isPro || activeTasks    < limits.tasks,
    canAddArea:    isPro || activeAreas    < limits.areas,
    canAddProject: isPro || activeProjects < limits.projects,
    taskUsagePct: isPro ? 0 : Math.min(100, Math.round((activeTasks / limits.tasks) * 100)),
  };
}
