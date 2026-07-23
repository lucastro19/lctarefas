import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Sidebar } from "./Sidebar";
import { MobileTabBar } from "./MobileTabBar";
import { MobileHeader } from "./MobileHeader";
import { MobileDrawer } from "./MobileDrawer";
import { useTaskStore, isDelegated } from "../../store/taskStore";
import { useSettingsStore, minutesToTime } from "../../store/settingsStore";
import { useUiStore } from "../../store/uiStore";
import { TaskDetail } from "../tasks/TaskDetail";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Próximo dia útil (pula sábado/domingo) — usado ao arrastar para "Em Breve"
const nextBusinessDayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function Layout({ children }) {
  const location = useLocation();
  const [activeTask, setActiveTask] = useState(null);
  const mainRef = useRef(null);
  const touchYRef = useRef(null);
  const autoScrollRAF = useRef(null);
  const isDraggingRef = useRef(false);
  const { tasks, updateTask, reorderTasks } = useTaskStore();
  const { calcTimes } = useSettingsStore();
  const { pendingTask, clearPendingTask, focusMode, toggleFocusMode, showToast, openDelegateFlow } = useUiStore();

  // Rastreia Y em capture phase (antes de qualquer stopPropagation do dnd-kit)
  useEffect(() => {
    const track = (e) => { touchYRef.current = e.touches[0]?.clientY ?? null; };
    document.addEventListener("touchmove", track, { passive: true, capture: true });
    return () => document.removeEventListener("touchmove", track, { capture: true });
  }, []);

  // Loop de auto-scroll via rAF direto no scrollTop
  useEffect(() => {
    if (!activeTask) {
      cancelAnimationFrame(autoScrollRAF.current);
      touchYRef.current = null;
      return;
    }
    const ZONE = 160;
    const MAX_SPEED = 18;
    const loop = () => {
      const y = touchYRef.current;
      const el = mainRef.current;
      if (y !== null && el) {
        if (y < ZONE) {
          const speed = MAX_SPEED * Math.pow(1 - y / ZONE, 1.5);
          el.scrollTop = Math.max(0, el.scrollTop - speed);
        } else if (y > window.innerHeight - ZONE) {
          const speed = MAX_SPEED * Math.pow((y - (window.innerHeight - ZONE)) / ZONE, 1.5);
          el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + speed);
        }
      }
      autoScrollRAF.current = requestAnimationFrame(loop);
    };
    autoScrollRAF.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(autoScrollRAF.current);
  }, [activeTask]);

  const handleDragMove = ({ active }) => {
    // Obtém Y do overlay do dnd-kit como fonte alternativa se touch não estiver disponível
    const rect = active?.rect?.current?.translated;
    if (rect) touchYRef.current = rect.top + rect.height / 2;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } })
  );

  const handleDragStart = ({ active }) => {
    isDraggingRef.current = true;
    setActiveTask(tasks.find((t) => t.id === active.id) ?? null);
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
    setActiveTask(null);
  };

  const handleDragEnd = ({ active, over }) => {
    isDraggingRef.current = false;
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    const taskId = active.id;
    const target = String(over.id);

    // --- Cross-list drops to sidebar ---
    const movedTask = tasks.find((t) => t.id === taskId);
    const prevFields = movedTask ? {
      project_id: movedTask.project_id,
      area_id: movedTask.area_id,
      someday: movedTask.someday,
      scheduled_date: movedTask.scheduled_date,
      scheduled_time: movedTask.scheduled_time,
      archived_at: movedTask.archived_at,
    } : null;

    if (target === "inbox") {
      updateTask(taskId, { project_id: null, area_id: null, someday: false, scheduled_date: null, scheduled_time: null });
      if (prevFields) showToast({ message: "Tarefa movida para Inbox", action: "Desfazer", onAction: () => updateTask(taskId, prevFields) });
      return;
    }
    if (target === "today") {
      const t = todayStr();
      const { dayStart, defaultDurationMinutes } = useSettingsStore.getState();
      const [h, m] = dayStart.split(":").map(Number);
      let cursor = h * 60 + m;
      const otherTasks = tasks
        .filter((task) => task.id !== taskId && task.scheduled_date && task.scheduled_date <= t && !task.completed_at && !task.deleted_at && !task.archived_at && !isDelegated(task))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const task of otherTasks) cursor += task.duration_minutes ?? defaultDurationMinutes;
      updateTask(taskId, { scheduled_date: t, someday: false, archived_at: null, scheduled_time: minutesToTime(cursor) });
      if (prevFields) showToast({ message: "Tarefa movida para Hoje", action: "Desfazer", onAction: () => updateTask(taskId, prevFields) });
      return;
    }
    if (target === "someday") {
      updateTask(taskId, { someday: true, scheduled_date: null, archived_at: null, scheduled_time: null });
      if (prevFields) showToast({ message: "Tarefa movida para Depois", action: "Desfazer", onAction: () => updateTask(taskId, prevFields) });
      return;
    }
    if (target === "upcoming") {
      const t = nextBusinessDayStr();
      const { dayStart, defaultDurationMinutes } = useSettingsStore.getState();
      const [h, m] = dayStart.split(":").map(Number);
      let cursor = h * 60 + m;
      const otherTasks = tasks
        .filter((task) => task.id !== taskId && task.scheduled_date === t && !task.completed_at && !task.deleted_at && !task.archived_at && !isDelegated(task))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      for (const task of otherTasks) cursor += task.duration_minutes ?? defaultDurationMinutes;
      updateTask(taskId, { scheduled_date: t, someday: false, archived_at: null, scheduled_time: minutesToTime(cursor) });
      if (prevFields) showToast({ message: "Tarefa movida para o próximo dia útil", action: "Desfazer", onAction: () => updateTask(taskId, prevFields) });
      return;
    }
    if (target.startsWith("area-")) {
      updateTask(taskId, { area_id: target.slice(5), project_id: null, someday: false, scheduled_time: null });
      if (prevFields) showToast({ message: "Tarefa movida para área", action: "Desfazer", onAction: () => updateTask(taskId, prevFields) });
      return;
    }
    if (target.startsWith("project-")) {
      updateTask(taskId, { project_id: target.slice(8), area_id: null, someday: false, scheduled_time: null });
      if (prevFields) showToast({ message: "Tarefa movida para projeto", action: "Desfazer", onAction: () => updateTask(taskId, prevFields) });
      return;
    }
    if (target.startsWith("collab-")) {
      // Abre o modal de data de cobrança — delegateTask só roda quando confirmar lá
      openDelegateFlow(taskId, target.slice(7));
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-screen overflow-hidden bg-bg">
        {!pendingTask && <MobileHeader />}
        <div className="flex flex-1 overflow-hidden">
        {!focusMode && <Sidebar />}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto relative pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          {/* Botão para revelar a sidebar quando ela está oculta */}
          {focusMode && (
            <button
              onClick={toggleFocusMode}
              title="Mostrar barra lateral"
              className="hidden md:flex absolute top-4 left-4 z-10 w-8 h-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-main hover:bg-card border border-border transition-all shadow-sm"
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect x="0.6" y="0.6" width="16.8" height="12.8" rx="2.4" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="6" y1="0.6" x2="6" y2="13.4" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="2" y1="4.5" x2="4.5" y2="4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="2" y1="7" x2="4.5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <line x1="2" y1="9.5" x2="4.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <div key={location.pathname} className="page-enter h-full">{children}</div>
        </main>
        {pendingTask && (
          <div className="fixed right-0 top-0 h-full z-[60] shadow-2xl">
            <TaskDetail key={pendingTask.id} task={pendingTask} onClose={clearPendingTask} />
          </div>
        )}
        </div>
      </div>
      {!pendingTask && <MobileTabBar />}
      <MobileDrawer />

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
