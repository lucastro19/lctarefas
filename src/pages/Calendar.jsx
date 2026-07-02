import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext, DragOverlay,
  useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useTaskStore } from "../store/taskStore";
import { TaskDetail } from "../components/tasks/TaskDetail";

/* ── Helpers ── */
function localDateStr(d = new Date()) {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

function addDays(d, n) {
  const r = new Date(d + "T12:00:00");
  r.setDate(r.getDate() + n);
  return localDateStr(r);
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return localDateStr(d);
}

function formatMonthYear(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toLowerCase();
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ── Constantes ── */
const HOUR_HEIGHT = 56; // px por hora — menor para caber mais na tela
const GRID_START_H = 6;
const GRID_END_H = 23;
const STRIP_BACK = 14;
const STRIP_FORWARD = 60;

const gridHours = Array.from(
  { length: GRID_END_H - GRID_START_H },
  (_, i) => GRID_START_H + i
);

const VIEWS = [
  { id: "day",      label: "Dia",    shortcut: "D", cols: 1 },
  { id: "3day",     label: "3 dias", shortcut: "3", cols: 3 },
  { id: "workweek", label: "Úteis",  shortcut: "U", cols: 5 },
  { id: "week",     label: "Semana", shortcut: "S", cols: 7 },
];

function getDaysForView(view, anchorDate) {
  if (view === "day") return [anchorDate];
  if (view === "3day") return [0, 1, 2].map((n) => addDays(anchorDate, n));
  const mon = mondayOf(anchorDate);
  if (view === "workweek") return [0, 1, 2, 3, 4].map((n) => addDays(mon, n));
  return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(mon, n));
}

function navigateView(view, anchor, dir) {
  return addDays(anchor, dir * ({ day: 1, "3day": 3, workweek: 7, week: 7 }[view] ?? 1));
}

function snapToQuarter(min) {
  return Math.round(min / 15) * 15;
}

/* ── Ponto de carga ── */
function LoadDot({ count }) {
  if (count === 0) return <div className="h-1 w-1" />;
  const cls = count < 3 ? "bg-success" : count < 6 ? "bg-warning" : "bg-danger";
  return <div className={`w-1.5 h-1.5 rounded-full ${cls}`} />;
}

/* ── Barra de carga ── */
function LoadBar({ minutes }) {
  const pct = Math.min(100, (minutes / (8 * 60)) * 100);
  if (pct === 0) return null;
  const color = minutes < 180 ? "#34C759" : minutes < 360 ? "#FF9500" : "#FF3B30";
  return (
    <div className="h-0.5 rounded-full bg-border/40 overflow-hidden w-full mt-0.5">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/* ── Strip horizontal de dias ── */
function DayStrip({ anchorDate, today, tasksByDay, onSelect, view }) {
  const activeRef = useRef(null);
  const mounted = useRef(false);
  const days = Array.from({ length: STRIP_BACK + 1 + STRIP_FORWARD }, (_, i) => addDays(today, i - STRIP_BACK));
  const viewDays = getDaysForView(view, anchorDate);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: mounted.current ? "smooth" : "instant",
        block: "nearest", inline: "center",
      });
      mounted.current = true;
    }
  }, [anchorDate, view]);

  return (
    <div className="flex gap-0.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {days.map((dateStr) => {
        const isToday = dateStr === today;
        const isInView = viewDays.includes(dateStr);
        const isAnchor = dateStr === anchorDate;
        const d = new Date(dateStr + "T12:00:00");
        const dayNum = d.getDate();
        const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
        const activeTasks = (tasksByDay[dateStr] ?? []).filter((t) => !t.completed_at);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        return (
          <button
            key={dateStr}
            ref={isAnchor ? activeRef : null}
            onClick={() => onSelect(dateStr)}
            className={[
              "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl shrink-0 transition-all min-w-[40px] cursor-pointer",
              isInView ? "bg-primary/10 border border-primary/25" : "hover:bg-card border border-transparent",
            ].join(" ")}
          >
            <span className={["text-[9px] font-semibold uppercase tracking-wide",
              isInView ? "text-primary" : isWeekend ? "text-danger/50" : "text-text-secondary"].join(" ")}>
              {dayLabel}
            </span>
            <span className={["w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold",
              isToday && isInView ? "bg-primary text-white" :
              isToday ? "bg-primary/20 text-primary" :
              isInView ? "text-primary font-bold" :
              isWeekend ? "text-text-secondary/50" : "text-text-main"].join(" ")}>
              {dayNum}
            </span>
            <LoadDot count={activeTasks.length} />
          </button>
        );
      })}
    </div>
  );
}

/* ── Conteúdo visual de um bloco de tarefa (reutilizado no DragOverlay) ── */
function TaskBlockContent({ task, height, onToggle, onSelect }) {
  const isDone = !!task.completed_at;
  const isUrgent = task.is_urgent && !isDone;

  const borderColor = isDone ? "#48484A" : isUrgent ? "#FF3B30" : "#4F8EF7";
  const bgColor = isDone ? "rgba(58,58,60,0.6)" : isUrgent ? "rgba(255,59,48,0.12)" : "rgba(79,142,247,0.12)";
  const textColor = isDone ? "#8E8E93" : isUrgent ? "#FF3B30" : "#4F8EF7";

  return (
    <div
      className="w-full h-full flex items-start gap-1.5 px-2 py-1 rounded-md overflow-hidden"
      style={{ backgroundColor: bgColor, borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Botão circular de conclusão */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle?.(task); }}
        className={[
          "shrink-0 w-3.5 h-3.5 mt-[2px] rounded-full border-2 flex items-center justify-center transition-colors",
          isDone ? "border-[#8E8E93] bg-[#8E8E93]" : isUrgent ? "border-danger hover:bg-danger/20" : "border-primary hover:bg-primary/20",
        ].join(" ")}
        title={isDone ? "Desmarcar" : "Concluir"}
      >
        {isDone && (
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
            <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className={["text-[11px] font-semibold leading-tight truncate", isDone ? "line-through" : ""].join(" ")}
          style={{ color: textColor }}>
          {task.title}
        </p>
        {height > 40 && task.scheduled_time && (
          <p className="text-[9px] text-text-secondary leading-none mt-0.5">
            {task.scheduled_time.slice(0, 5)} · {task.duration_minutes ?? 30}min
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Bloco de tarefa arrastável ── */
function DraggableTaskBlock({ task, onSelect, onToggle }) {
  const startMin = timeToMinutes(task.scheduled_time) ?? (GRID_START_H * 60);
  const duration = task.duration_minutes ?? 30;
  const top = ((startMin - GRID_START_H * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(28, (duration / 60) * HOUR_HEIGHT);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top,
        left: 3,
        right: 3,
        height,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 0 : 2,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Se não houve drag, abre detalhe
        if (!isDragging) { e.stopPropagation(); onSelect(task); }
      }}
    >
      <TaskBlockContent task={task} height={height} onToggle={onToggle} onSelect={onSelect} />
    </div>
  );
}

/* ── Coluna de um dia (droppable) ── */
function DroppableDayColumn({ dateStr, children, isToday }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  return (
    <div
      ref={setNodeRef}
      className={[
        "flex-1 relative border-l border-border/30 min-w-0 transition-colors",
        isToday ? "bg-primary/[0.015]" : "",
        isOver ? "bg-primary/[0.06]" : "",
      ].join(" ")}
      style={{ minWidth: 0 }}
    >
      {children}
    </div>
  );
}

/* ── Grid de horas multi-dia ── */
function TimeGrid({ days, tasksByDay, today, onTaskSelect, onTaskToggle, gridScrollRef }) {
  return (
    <div
      ref={gridScrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden"
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Container de altura fixa — width 100% garante que não haja scroll horizontal */}
      <div style={{ height: gridHours.length * HOUR_HEIGHT, width: "100%", position: "relative" }} className="flex">

        {/* Rótulos de hora — coluna fixa */}
        <div className="w-11 shrink-0 relative z-10" style={{ background: "inherit" }}>
          {gridHours.map((h) => (
            <div
              key={h}
              style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT, right: 0, left: 0 }}
              className="flex justify-end pr-2"
            >
              <span className="text-[9px] text-text-secondary/50 tabular-nums leading-none -mt-[5px] select-none">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {days.map((dateStr) => {
          const isToday = dateStr === today;
          const timedTasks = (tasksByDay[dateStr] ?? []).filter((t) => t.scheduled_time);
          return (
            <DroppableDayColumn key={dateStr} dateStr={dateStr} isToday={isToday}>
              {/* Linhas de hora */}
              {gridHours.map((h) => (
                <div
                  key={h}
                  style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT, left: 0, right: 0 }}
                  className={h % 2 === 0 ? "border-t border-border/30" : "border-t border-border/12"}
                />
              ))}
              {/* Blocos de tarefa */}
              {timedTasks.map((t) => (
                <DraggableTaskBlock
                  key={t.id}
                  task={t}
                  onSelect={onTaskSelect}
                  onToggle={onTaskToggle}
                />
              ))}
            </DroppableDayColumn>
          );
        })}

        {/* Linha de horário atual */}
        {days.includes(today) && (() => {
          const now = new Date();
          const min = now.getHours() * 60 + now.getMinutes();
          if (min < GRID_START_H * 60 || min >= GRID_END_H * 60) return null;
          const top = ((min - GRID_START_H * 60) / 60) * HOUR_HEIGHT;
          return (
            <div
              style={{ position: "absolute", top, left: 44, right: 0, zIndex: 20, pointerEvents: "none" }}
              className="flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-danger shrink-0 -ml-1" />
              <div className="flex-1 border-t-[1.5px] border-danger" />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function Calendar() {
  const { tasks, updateTask, completeTask, uncompleteTask } = useTaskStore();
  const today = localDateStr();

  const [view, setView] = useState("day");
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedTask, setSelectedTask] = useState(null);
  const [draggingTask, setDraggingTask] = useState(null);

  const gridScrollRef = useRef(null);

  const days = getDaysForView(view, anchorDate);

  const tasksByDay = tasks.reduce((acc, t) => {
    if (!t.scheduled_date || t.deleted_at) return acc;
    (acc[t.scheduled_date] ??= []).push(t);
    return acc;
  }, {});

  const goBack    = useCallback(() => setAnchorDate((d) => navigateView(view, d, -1)), [view]);
  const goForward = useCallback(() => setAnchorDate((d) => navigateView(view, d,  1)), [view]);
  const goToday   = useCallback(() => setAnchorDate(today), [today]);

  const handleToggle = useCallback(async (task) => {
    if (task.completed_at) await uncompleteTask(task.id);
    else await completeTask(task.id);
  }, [completeTask, uncompleteTask]);

  /* ── DnD ── */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // ≥ 6px de movimento para iniciar drag
    })
  );

  const handleDragStart = ({ active }) => {
    setDraggingTask(active.data.current?.task ?? null);
  };

  const handleDragEnd = ({ active, over, delta }) => {
    setDraggingTask(null);
    if (!over || !active.data.current) return;

    const task = active.data.current.task;
    const newDate = over.id;

    // Calcula novo horário pelo deslocamento vertical
    const origMin = timeToMinutes(task.scheduled_time) ?? (GRID_START_H * 60);
    const deltaMin = (delta.y / HOUR_HEIGHT) * 60;
    const snapped = snapToQuarter(origMin + deltaMin);
    const clampedMin = Math.max(GRID_START_H * 60, Math.min((GRID_END_H - 1) * 60, snapped));
    const newTime = minutesToTime(clampedMin);

    const changed = newDate !== task.scheduled_date || newTime !== task.scheduled_time;
    if (changed) updateTask(task.id, { scheduled_date: newDate, scheduled_time: newTime });
  };

  /* ── Atalhos de teclado ── */
  useEffect(() => {
    const handler = (e) => {
      const el = e.target;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.key === "Escape" && selectedTask) { setSelectedTask(null); return; }
      const k = e.key.toLowerCase();
      if (k === "d" || k === "1")          { setView("day"); return; }
      if (k === "3")                        { setView("3day"); return; }
      if (k === "u")                        { setView("workweek"); return; }
      if (k === "s" || k === "7")           { setView("week"); return; }
      if (k === "t")                        { goToday(); return; }
      if (k === "arrowleft"  || k === "k") { goBack(); return; }
      if (k === "arrowright" || k === "j") { goForward(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward, goToday, selectedTask]);

  /* ── Scroll para horário atual no mount ── */
  useEffect(() => {
    if (gridScrollRef.current) {
      const now = new Date();
      const min = now.getHours() * 60 + now.getMinutes();
      const offset = ((min - GRID_START_H * 60) / 60) * HOUR_HEIGHT - 100;
      gridScrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, []);

  /* ── Dados resumidos ── */
  const totalActive = days.reduce((s, d) => s + (tasksByDay[d] ?? []).filter((t) => !t.completed_at).length, 0);
  const totalMinutes = days.reduce(
    (s, d) => s + (tasksByDay[d] ?? []).filter((t) => !t.completed_at).reduce((a, t) => a + (t.duration_minutes ?? 30), 0), 0
  );

  const monthLabel = formatMonthYear(days[0]);

  /* ── Cabeçalho das colunas (fora do scroll) ── */
  const DayHeaders = () => (
    <div className="flex shrink-0 border-b border-border bg-card/50">
      <div className="w-11 shrink-0" />
      {days.map((dateStr) => {
        const d = new Date(dateStr + "T12:00:00");
        const isToday = dateStr === today;
        const activeTasks = (tasksByDay[dateStr] ?? []).filter((t) => !t.completed_at);
        const mins = activeTasks.reduce((s, t) => s + (t.duration_minutes ?? 30), 0);
        const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const untimedCount = (tasksByDay[dateStr] ?? []).filter((t) => !t.scheduled_time && !t.completed_at).length;

        return (
          <div
            key={dateStr}
            className={[
              "flex-1 flex flex-col items-center py-2 px-1 min-w-0 border-l border-border/40",
              isToday ? "bg-primary/5" : "",
            ].join(" ")}
          >
            <span className={["text-[10px] font-semibold uppercase tracking-wide",
              isToday ? "text-primary" : isWeekend ? "text-danger/60" : "text-text-secondary"].join(" ")}>
              {dayLabel}
            </span>
            <span className={["w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mt-0.5",
              isToday ? "bg-primary text-white" : "text-text-main"].join(" ")}>
              {d.getDate()}
            </span>
            <LoadBar minutes={mins} />
            {untimedCount > 0 && (
              <span className="text-[8px] text-text-secondary/60 mt-0.5">{untimedCount} sem hora</span>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── Chips de tarefas sem horário ── */
  const UntimedSection = () => {
    const untimedByDay = days.map((d) => (tasksByDay[d] ?? []).filter((t) => !t.scheduled_time));
    if (!untimedByDay.some((a) => a.length)) return null;
    return (
      <div className="flex shrink-0 border-b border-border/40 max-h-20 overflow-y-auto">
        <div className="w-11 shrink-0 flex items-center justify-center">
          <span className="text-[8px] text-text-secondary/40 leading-tight text-center select-none">sem<br />hora</span>
        </div>
        {days.map((dateStr, i) => (
          <div key={dateStr} className="flex-1 flex flex-wrap gap-1 p-1.5 min-w-0 border-l border-border/30">
            {untimedByDay[i].slice(0, 3).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={[
                  "text-[9px] px-1.5 py-0.5 rounded border truncate max-w-full",
                  t.completed_at ? "border-border/40 text-[#636366] line-through" :
                  t.is_urgent ? "border-danger/40 bg-danger/10 text-danger" :
                  "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
                ].join(" ")}
              >
                {t.title}
              </button>
            ))}
            {untimedByDay[i].length > 3 && (
              <span className="text-[8px] text-text-secondary self-center">
                +{untimedByDay[i].length - 3}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-hidden">

        {/* Área principal */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden px-3 pt-4 pb-2 md:px-5">

          {/* Título — linha própria para não colidir com botão Foco */}
          <h1 className="text-xl font-semibold text-text-main mb-2 shrink-0">Calendário</h1>

          {/* Nav + mês + visões — com mr-36 para evitar botão Foco */}
          <div className="flex items-center gap-2 mb-2 shrink-0 mr-36">
            <div className="flex items-center gap-0.5">
              <button onClick={goBack} title="← ou K"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors text-base">‹</button>
              <button onClick={goToday} title="T"
                className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors">Hoje</button>
              <button onClick={goForward} title="→ ou J"
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors text-base">›</button>
            </div>
            <span className="text-sm text-text-secondary capitalize flex-1 min-w-0 truncate">{monthLabel}</span>
            {/* Selector de visão */}
            <div className="flex gap-0.5 bg-bg rounded-lg p-0.5 border border-border shrink-0">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  title={`${v.label} (${v.shortcut})`}
                  className={["text-[11px] px-2 py-1 rounded-md transition-colors whitespace-nowrap",
                    view === v.id ? "bg-card shadow-sm text-text-main font-medium" : "text-text-secondary hover:text-text-main"].join(" ")}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strip de dias */}
          <div className="shrink-0 mb-2">
            <DayStrip anchorDate={anchorDate} today={today} tasksByDay={tasksByDay} onSelect={setAnchorDate} view={view} />
          </div>

          {/* Resumo */}
          {totalActive > 0 && (
            <p className="text-[10px] text-text-secondary mb-1.5 shrink-0">
              {totalActive} tarefa{totalActive !== 1 ? "s" : ""} · {Math.round(totalMinutes / 60)}h agendadas
              <span className="ml-2 opacity-50">arrastar para mover · clique para editar</span>
            </p>
          )}

          {/* Grade — ocupa todo o espaço restante */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border overflow-hidden">
            <DayHeaders />
            <UntimedSection />
            <TimeGrid
              days={days}
              tasksByDay={tasksByDay}
              today={today}
              onTaskSelect={setSelectedTask}
              onTaskToggle={handleToggle}
              gridScrollRef={gridScrollRef}
            />
          </div>
        </div>

        {/* Painel lateral de edição */}
        {selectedTask && (
          <div onClick={(e) => e.stopPropagation()}>
            <TaskDetail
              key={selectedTask.id}
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
            />
          </div>
        )}
      </div>

      {/* Preview durante o drag */}
      <DragOverlay dropAnimation={null}>
        {draggingTask && (
          <div
            style={{
              height: Math.max(28, ((draggingTask.duration_minutes ?? 30) / 60) * HOUR_HEIGHT),
              width: 160,
              opacity: 0.85,
            }}
            className="rounded-md shadow-lg"
          >
            <TaskBlockContent task={draggingTask} height={Math.max(28, ((draggingTask.duration_minutes ?? 30) / 60) * HOUR_HEIGHT)} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
