import { useState, useRef, useEffect, useCallback } from "react";
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
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

function formatMonthYear(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/* ── Constantes ── */
const HOUR_HEIGHT = 64;
const GRID_START_H = 6;
const GRID_END_H = 23;
const STRIP_BACK = 14;
const STRIP_FORWARD = 60;

const gridHours = Array.from(
  { length: GRID_END_H - GRID_START_H },
  (_, i) => GRID_START_H + i
);

/* ── Configuração de visões ── */
const VIEWS = [
  { id: "day",      label: "Dia",    shortcut: "D", cols: 1 },
  { id: "3day",     label: "3 dias", shortcut: "3", cols: 3 },
  { id: "workweek", label: "Úteis",  shortcut: "U", cols: 5 },
  { id: "week",     label: "Semana", shortcut: "S", cols: 7 },
];

function getDaysForView(view, anchorDate) {
  if (view === "day") return [anchorDate];
  if (view === "3day") return [0, 1, 2].map((n) => addDays(anchorDate, n));
  if (view === "workweek") {
    const mon = mondayOf(anchorDate);
    return [0, 1, 2, 3, 4].map((n) => addDays(mon, n));
  }
  if (view === "week") {
    const mon = mondayOf(anchorDate);
    return [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(mon, n));
  }
  return [anchorDate];
}

function navigateView(view, anchorDate, dir) {
  const steps = { day: 1, "3day": 3, workweek: 7, week: 7 };
  return addDays(anchorDate, dir * (steps[view] ?? 1));
}

/* ── Mini indicador de carga (ponto colorido) ── */
function LoadDot({ tasks }) {
  const totalMinutes = tasks.reduce((s, t) => s + (t.duration_minutes ?? 30), 0);
  const h = totalMinutes / 60;
  if (h === 0) return <div className="h-1 w-1 rounded-full" />;
  const color = h < 3 ? "bg-success" : h < 6 ? "bg-warning" : "bg-danger";
  const size = h < 2 ? "w-1.5 h-1.5" : h < 5 ? "w-2 h-2" : "w-2.5 h-2.5";
  return <div className={`rounded-full ${size} ${color} opacity-80`} />;
}

/* ── Barra de carga inline ── */
function LoadBar({ tasks }) {
  const totalMinutes = tasks.reduce((s, t) => s + (t.duration_minutes ?? 30), 0);
  const h = totalMinutes / 60;
  const pct = Math.min(100, (h / 8) * 100);
  const color = h < 3 ? "#34C759" : h < 6 ? "#FF9500" : "#FF3B30";
  if (pct === 0) return null;
  return (
    <div className="h-1 rounded-full bg-border/40 overflow-hidden w-full">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/* ── Strip horizontal de dias (navegação compacta) ── */
function DayStrip({ anchorDate, today, tasksByDay, onSelect, view }) {
  const activeRef = useRef(null);
  const mounted = useRef(false);

  const days = Array.from(
    { length: STRIP_BACK + 1 + STRIP_FORWARD },
    (_, i) => addDays(today, i - STRIP_BACK)
  );

  const viewDays = getDaysForView(view, anchorDate);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: mounted.current ? "smooth" : "instant",
        block: "nearest",
        inline: "center",
      });
      mounted.current = true;
    }
  }, [anchorDate, view]);

  return (
    <div className="flex gap-0.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {days.map((dateStr) => {
        const isToday = dateStr === today;
        const isInView = viewDays.includes(dateStr);
        const isAnchor = dateStr === anchorDate;
        const d = new Date(dateStr + "T12:00:00");
        const dayNum = d.getDate();
        const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3);
        const tasks = tasksByDay[dateStr] ?? [];
        const activeTasks = tasks.filter((t) => !t.completed_at);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        return (
          <button
            key={dateStr}
            ref={isAnchor ? activeRef : null}
            onClick={() => onSelect(dateStr)}
            className={[
              "flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl shrink-0 transition-all min-w-[40px]",
              isInView
                ? "bg-primary/10 border border-primary/25"
                : "hover:bg-card border border-transparent",
            ].join(" ")}
          >
            <span className={[
              "text-[9px] font-semibold uppercase tracking-wide",
              isInView ? "text-primary" : isWeekend ? "text-danger/50" : "text-text-secondary",
            ].join(" ")}>
              {dayLabel}
            </span>
            <span className={[
              "w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold transition-colors",
              isToday && isInView ? "bg-primary text-white" :
              isToday ? "bg-primary/20 text-primary" :
              isInView ? "text-primary font-bold" :
              isWeekend ? "text-text-secondary/50" :
              "text-text-main",
            ].join(" ")}>
              {dayNum}
            </span>
            <LoadDot tasks={activeTasks} />
          </button>
        );
      })}
    </div>
  );
}

/* ── Bloco de tarefa na timeline ── */
function TaskBlock({ task, onSelect }) {
  const startMin = timeToMinutes(task.scheduled_time) ?? (GRID_START_H * 60);
  const duration = task.duration_minutes ?? 30;
  const top = ((startMin - GRID_START_H * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(22, (duration / 60) * HOUR_HEIGHT);
  const isDone = !!task.completed_at;
  const isUrgent = task.is_urgent && !isDone;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(task); }}
      style={{ position: "absolute", top, left: 2, right: 2, height }}
      className={[
        "rounded-lg px-1.5 py-1 cursor-pointer overflow-hidden transition-opacity hover:opacity-85 select-none",
        isDone ? "bg-border/40 opacity-50" :
        isUrgent ? "bg-danger/15 border border-danger/30" :
        "bg-primary/15 border border-primary/20",
      ].join(" ")}
    >
      <p className={[
        "text-[10px] font-medium leading-tight truncate",
        isDone ? "line-through text-text-secondary" :
        isUrgent ? "text-danger" : "text-primary",
      ].join(" ")}>
        {task.title}
      </p>
      {height > 34 && (
        <p className="text-[9px] text-text-secondary leading-none mt-0.5">
          {task.scheduled_time?.slice(0, 5)} · {duration}min
        </p>
      )}
    </div>
  );
}

/* ── Timeline multi-dia (1, 3, 5 ou 7 colunas) ── */
function MultiDayTimeline({ days, tasksByDay, today, onTaskSelect }) {
  const scrollRef = useRef(null);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isCurrentWeek = days.includes(today);

  useEffect(() => {
    if (scrollRef.current) {
      const targetMin = isCurrentWeek ? nowMinutes : GRID_START_H * 60 + 120;
      const offset = ((targetMin - GRID_START_H * 60) / 60) * HOUR_HEIGHT - 80;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [days[0]]);

  // Coletar tarefas sem horário por dia
  const untimedByDay = days.map((d) =>
    (tasksByDay[d] ?? []).filter((t) => !t.scheduled_time)
  );
  const hasUntimed = untimedByDay.some((arr) => arr.length > 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Cabeçalho das colunas de dias */}
      <div className="flex shrink-0 border-b border-border">
        {/* Espaço para os rótulos de hora */}
        <div className="w-10 shrink-0" />
        {days.map((dateStr) => {
          const d = new Date(dateStr + "T12:00:00");
          const isToday = dateStr === today;
          const activeTasks = (tasksByDay[dateStr] ?? []).filter((t) => !t.completed_at);
          const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
          const dayNum = d.getDate();
          return (
            <div
              key={dateStr}
              className={[
                "flex-1 flex flex-col items-center py-1.5 px-1 min-w-0",
                isToday ? "bg-primary/5" : "",
              ].join(" ")}
            >
              <span className={[
                "text-[9px] font-semibold uppercase tracking-wide",
                isToday ? "text-primary" : "text-text-secondary",
              ].join(" ")}>
                {dayLabel}
              </span>
              <span className={[
                "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
                isToday ? "bg-primary text-white" : "text-text-main",
              ].join(" ")}>
                {dayNum}
              </span>
              <LoadBar tasks={activeTasks} />
            </div>
          );
        })}
      </div>

      {/* Linha "sem horário" */}
      {hasUntimed && (
        <div className="flex shrink-0 border-b border-border/50 bg-bg/50">
          <div className="w-10 shrink-0 flex items-center justify-end pr-1.5">
            <span className="text-[8px] text-text-secondary/50 leading-none">sem<br />hora</span>
          </div>
          {days.map((dateStr, i) => (
            <div key={dateStr} className="flex-1 flex flex-wrap gap-0.5 p-1 min-w-0 min-h-[28px]">
              {untimedByDay[i].slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onTaskSelect(t)}
                  className={[
                    "text-[9px] px-1.5 py-0.5 rounded-full border truncate max-w-full",
                    t.completed_at ? "border-border text-text-secondary line-through" :
                    t.is_urgent ? "border-danger/40 bg-danger/10 text-danger" :
                    "border-primary/30 bg-primary/10 text-primary",
                  ].join(" ")}
                >
                  {t.title}
                </button>
              ))}
              {untimedByDay[i].length > 3 && (
                <span className="text-[8px] text-text-secondary">+{untimedByDay[i].length - 3}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Grade horária */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div style={{ height: gridHours.length * HOUR_HEIGHT, position: "relative" }} className="flex">
          {/* Coluna de rótulos de hora */}
          <div className="w-10 shrink-0 relative">
            {gridHours.map((h) => (
              <div
                key={h}
                style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT }}
                className="right-0 left-0 flex justify-end pr-1.5"
              >
                <span className="text-[9px] text-text-secondary/60 leading-none -mt-[5px]">
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
              <div
                key={dateStr}
                className={["flex-1 relative border-l border-border/40 min-w-0", isToday ? "bg-primary/[0.02]" : ""].join(" ")}
              >
                {/* Linhas de hora */}
                {gridHours.map((h) => (
                  <div
                    key={h}
                    style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT, left: 0, right: 0 }}
                    className="border-t border-border/30"
                  />
                ))}
                {/* Blocos de tarefa */}
                {timedTasks.map((t) => (
                  <TaskBlock key={t.id} task={t} onSelect={onTaskSelect} />
                ))}
              </div>
            );
          })}

          {/* Linha do horário atual (span sobre todas as colunas) */}
          {isCurrentWeek && nowMinutes >= GRID_START_H * 60 && nowMinutes < GRID_END_H * 60 && (
            <div
              style={{
                position: "absolute",
                top: ((nowMinutes - GRID_START_H * 60) / 60) * HOUR_HEIGHT,
                left: 40,
                right: 0,
                zIndex: 20,
                pointerEvents: "none",
              }}
              className="flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-danger shrink-0 -ml-1" />
              <div className="flex-1 border-t-2 border-danger" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function Calendar() {
  const { tasks } = useTaskStore();
  const today = localDateStr();

  const [view, setView] = useState("day");
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedTask, setSelectedTask] = useState(null);

  const days = getDaysForView(view, anchorDate);

  const tasksByDay = tasks.reduce((acc, t) => {
    if (!t.scheduled_date || t.deleted_at) return acc;
    if (!acc[t.scheduled_date]) acc[t.scheduled_date] = [];
    acc[t.scheduled_date].push(t);
    return acc;
  }, {});

  const goBack = useCallback(() => setAnchorDate((d) => navigateView(view, d, -1)), [view]);
  const goForward = useCallback(() => setAnchorDate((d) => navigateView(view, d, 1)), [view]);
  const goToday = useCallback(() => setAnchorDate(today), [today]);

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (key === "d" || key === "1") { setView("day"); return; }
      if (key === "3")                { setView("3day"); return; }
      if (key === "u")                { setView("workweek"); return; }
      if (key === "s" || key === "7") { setView("week"); return; }
      if (key === "t")                { goToday(); return; }
      if (key === "arrowleft"  || (key === "k" && !e.metaKey)) { goBack(); return; }
      if (key === "arrowright" || (key === "j" && !e.metaKey)) { goForward(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward, goToday]);

  const monthLabel = formatMonthYear(days[0]);
  const activeDayCount = days.reduce((s, d) => s + (tasksByDay[d] ?? []).filter((t) => !t.completed_at).length, 0);

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-5 md:px-6">

        {/* Linha 1: Título */}
        <div className="shrink-0 mb-1">
          <h1 className="text-2xl font-semibold text-text-main">Calendário</h1>
        </div>

        {/* Linha 2: Mês + nav + visões */}
        <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
          {/* Nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors text-base"
              title="Anterior (← ou K)"
            >‹</button>
            <button
              onClick={goToday}
              className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors"
              title="Hoje (T)"
            >
              Hoje
            </button>
            <button
              onClick={goForward}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors text-base"
              title="Próximo (→ ou J)"
            >›</button>
          </div>

          {/* Mês */}
          <span className="text-sm text-text-secondary capitalize flex-1 min-w-0 truncate">{monthLabel}</span>

          {/* Visões */}
          <div className="flex gap-0.5 bg-bg rounded-lg p-0.5 border border-border shrink-0">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                title={`${v.label} (${v.shortcut})`}
                className={[
                  "text-[11px] px-2 py-1 rounded-md transition-colors whitespace-nowrap",
                  view === v.id
                    ? "bg-card shadow-sm text-text-main font-medium"
                    : "text-text-secondary hover:text-text-main",
                ].join(" ")}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strip de dias */}
        <div className="shrink-0 mb-2">
          <DayStrip
            anchorDate={anchorDate}
            today={today}
            tasksByDay={tasksByDay}
            onSelect={setAnchorDate}
            view={view}
          />
        </div>

        {/* Info resumida */}
        {activeDayCount > 0 && (
          <p className="text-[11px] text-text-secondary mb-1.5 shrink-0">
            {activeDayCount} tarefa{activeDayCount !== 1 ? "s" : ""} neste período
          </p>
        )}

        {/* Timeline */}
        <MultiDayTimeline
          days={days}
          tasksByDay={tasksByDay}
          today={today}
          onTaskSelect={(t) => setSelectedTask(t)}
        />
      </div>

      {/* Painel lateral */}
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
