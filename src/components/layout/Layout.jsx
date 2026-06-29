import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { useTaskStore } from "../../store/taskStore";
import { useSettingsStore, minutesToTime } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { TaskDetail } from "../tasks/TaskDetail";

const todayStr = () => new Date().toISOString().split("T")[0];

export function Layout({ children }) {
  const [activeTask, setActiveTask] = useState(null);
  const { tasks, updateTask, reorderTasks } = useTaskStore();
  const { calcTimes } = useSettingsStore();
  const { pendingTask, clearPendingTask, focusMode, toggleFocusMode } = useUiStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }) => {
    setActiveTask(tasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const taskId = active.id;
    const target = String(over.id);

    // --- Cross-list drops to sidebar ---
    if (target === "inbox") {
      updateTask(taskId, { project_id: null, area_id: null, someday: false, scheduled_date: null, scheduled_time: null });
      return;
    }
    if (target === "today") {
      const t = todayStr();
      const { dayStart, defaultDurationMinutes } = useSettingsStore.getState();
      const [h, m] = dayStart.split(":").map(Number);
      let cursor = h * 60 + m;
      const otherTasks = tasks
        .filter((task) => task.id !== taskId && task.scheduled_date && task.scheduled_date <= t && !task.completed_at && !task.deleted_at && !task.archived_at)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const task of otherTasks) cursor += task.duration_minutes ?? defaultDurationMinutes;
      updateTask(taskId, { scheduled_date: t, someday: false, archived_at: null, scheduled_time: minutesToTime(cursor) });
      return;
    }
    if (target === "someday") {
      updateTask(taskId, { someday: true, scheduled_date: null, archived_at: null, scheduled_time: null });
      return;
    }
    if (target.startsWith("area-")) {
      updateTask(taskId, { area_id: target.slice(5), project_id: null, someday: false, scheduled_time: null });
      return;
    }
    if (target.startsWith("project-")) {
      updateTask(taskId, { project_id: target.slice(8), area_id: null, someday: false, scheduled_time: null });
      return;
    }

    // --- Sort within list ---
    const oldIndex = tasks.findIndex((t) => t.id === taskId);
    const newIndex = tasks.findIndex((t) => t.id === target);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...tasks], oldIndex, newIndex);

    // Recalculate times for Today tasks (those with scheduled_date <= today)
    const t = todayStr();
    const todayReordered = reordered.filter(
      (task) => task.scheduled_date && task.scheduled_date <= t && !task.completed_at && !task.deleted_at && !task.archived_at
    );
    const timeUpdates = calcTimes(todayReordered);

    reorderTasks(reordered, timeUpdates);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen overflow-hidden bg-bg">
        {!focusMode && <Sidebar />}
        <main className="flex-1 overflow-y-auto relative pb-16 md:pb-0">
          <button
            onClick={toggleFocusMode}
            title={focusMode ? "Sair do modo foco (⌘⇧F)" : "Modo foco (⌘⇧F)"}
            className={[
              "absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              focusMode
                ? "bg-primary text-white shadow-md hover:bg-primary/90"
                : "bg-card border border-[#C7C7CC] text-text-secondary hover:text-primary hover:border-primary shadow-sm dark:border-[#48484A]",
            ].join(" ")}
          >
            <span className="text-sm leading-none">{focusMode ? "⊞" : "⊡"}</span>
            <span>{focusMode ? "Sair do foco" : "Foco"}</span>
          </button>
          {children}
        </main>
        {pendingTask && (
          <div className="fixed right-0 top-0 h-full z-40 shadow-2xl">
            <TaskDetail key={pendingTask.id} task={pendingTask} onClose={clearPendingTask} />
          </div>
        )}
      </div>
      <MobileTabBar />

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="task-card task-card-row shadow-xl opacity-90 pointer-events-none max-w-md">
            <p className="text-sm text-text-main truncate">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
