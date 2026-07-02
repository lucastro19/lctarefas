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
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
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

function navigateView(view, anchorDate, dir) {
  return addDays(anchorDate, dir * ({ day: 1, "3day": 3, workweek: 7, week: 7 }[view] ?? 1));
}

/* ── Mini ponto de carga ── */
function LoadDot({ tasks }) {
  const h = tasks.reduce((s, t) => s + (t.duration_minutes ?? 30), 0) / 60;
  if (h === 0) return <div className="h-1.5 w-1.5 rounded-full" />;
  const cls = h < 3 ? "bg-success" : h < 6 ? "bg-warning" : "bg-danger";
  const sz = h < 2 ? "w-1.5 h-1.5" : h < 5 ? "w-2 h-2" : "w-2.5 h-2.5";
  return <div className={`rounded-full ${sz} ${cls}`} />;
}

/* ── Barra de carga ── */
function LoadBar({ tasks }) {
  const h = tasks.reduce((s, t) => s + (t.duration_minutes ?? 30), 0) / 60;
  const pct = Math.min(100, (h / 8) * 100);
  const color = h < 3 ? "#34C759" : h < 6 ? "#FF9500" : "#FF3B30";
  if (pct === 0) return null;
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
        const activeTasks = (tasksByDay[dateStr] ?? []).filter((t) => !t.completed_at);
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
            <span className={["text-[9px] font-semibold uppercase tracking-wide", isInView ? "text-primary" : isWeekend ? "text-danger/50" : "text-text-secondary"].join(" ")}>
              {dayLabel}
            </span>
            <span className={["w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold",
              isToday && isInView ? "bg-primary text-white" :
              isToday ? "bg-primary/20 text-primary" :
              isInView ? "text-primary font-bold" :
              isWeekend ? "text-text-secondary/50" : "text-text-main",
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
function TaskBlock({ task, onSelect, onToggle }) {
  const startMin = timeToMinutes(task.scheduled_time) ?? (GRID_START_H * 60);
  const duration = task.duration_minutes ?? 30;
  const top = ((startMin - GRID_START_H * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(28, (duration / 60) * HOUR_HEIGHT);
  const isDone = !!task.completed_at;
  const isUrgent = task.is_urgent && !isDone;

  // Paleta por estado
  const bg = isDone
    ? "bg-[#3A3A3C]"
    : isUrgent
    ? "bg-danger/20 border-l-2 border-danger"
    : "bg-primary/20 border-l-2 border-primary";

  const titleCls = isDone
    ? "line-through text-[#8E8E93]"
    : isUrgent
    ? "text-danger font-semibold"
    : "text-primary font-semibold";

  return (
    <div
      style={{ position: "absolute", top, left: 3, right: 3, height }}
      className={["rounded-md overflow-hidden cursor-pointer select-none transition-all hover:brightness-110 active:scale-[0.98] flex items-start gap-1.5 px-1.5 py-1", bg].join(" ")}
      onClick={(e) => { e.stopPropagation(); onSelect(task); }}
    >
      {/* Botão de conclusão circular */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(task); }}
        title={isDone ? "Desmarcar" : "Concluir"}
        className={[
          "shrink-0 w-3.5 h-3.5 mt-[1px] rounded-full border-2 flex items-center justify-center transition-all",
          isDone
            ? "bg-[#8E8E93] border-[#8E8E93]"
            : isUrgent
            ? "border-danger hover:bg-danger/30"
            : "border-primary hover:bg-primary/30",
        ].join(" ")}
      >
        {isDone && (
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
            <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className={["text-[11px] leading-tight truncate", titleCls].join(" ")}>
          {task.title}
        </p>
        {height > 40 && (
          <p className={["text-[9px] leading-none mt-0.5", isDone ? "text-[#636366]" : "text-text-secondary"].join(" ")}>
            {task.scheduled_time?.slice(0, 5)} · {duration}min
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Timeline multi-dia ── */
function MultiDayTimeline({ days, tasksByDay, today, onTaskSelect, onTaskToggle }) {
  const scrollRef = useRef(null);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isCurrentPeriod = days.includes(today);

  useEffect(() => {
    if (scrollRef.current) {
      const targetMin = isCurrentPeriod ? nowMinutes : GRID_START_H * 60 + 120;
      const offset = ((targetMin - GRID_START_H * 60) / 60) * HOUR_HEIGHT - 100;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [days[0]]);

  const untimedByDay = days.map((d) => (tasksByDay[d] ?? []).filter((t) => !t.scheduled_time));
  const hasUntimed = untimedByDay.some((arr) => arr.length > 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-border overflow-hidden">

      {/* Cabeçalhos das colunas */}
      <div className="flex shrink-0 border-b border-border bg-card">
        <div className="w-12 shrink-0" />
        {days.map((dateStr) => {
          const d = new Date(dateStr + "T12:00:00");
          const isToday = dateStr === today;
          const activeTasks = (tasksByDay[dateStr] ?? []).filter((t) => !t.completed_at);
          const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
          const dayNum = d.getDate();
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div
              key={dateStr}
              className={["flex-1 flex flex-col items-center py-2 px-1 min-w-0 border-l border-border/40", isToday ? "bg-primary/5" : ""].join(" ")}
            >
              <span className={["text-[10px] font-semibold uppercase tracking-wide", isToday ? "text-primary" : isWeekend ? "text-danger/60" : "text-text-secondary"].join(" ")}>
                {dayLabel}
              </span>
              <span className={["w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold mt-0.5", isToday ? "bg-primary text-white" : "text-text-main"].join(" ")}>
                {dayNum}
              </span>
              <LoadBar tasks={activeTasks} />
            </div>
          );
        })}
      </div>

      {/* Linha "sem horário" */}
      {hasUntimed && (
        <div className="flex shrink-0 border-b border-border/50 bg-bg/30">
          <div className="w-12 shrink-0 flex items-center justify-center">
            <span className="text-[8px] text-text-secondary/50 leading-tight text-center">sem<br />hora</span>
          </div>
          {days.map((dateStr, i) => {
            const tasks = untimedByDay[i];
            return (
              <div key={dateStr} className="flex-1 flex flex-wrap gap-1 p-1.5 min-w-0 min-h-[32px] border-l border-border/30">
                {tasks.slice(0, 2).map((t) => (
                  <div key={t.id} className="flex items-center gap-1">
                    <button
                      onClick={() => onTaskToggle(t)}
                      className={["w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0",
                        t.completed_at ? "bg-[#8E8E93] border-[#8E8E93]" : "border-primary"
                      ].join(" ")}
                    >
                      {t.completed_at && (
                        <svg width="6" height="4" viewBox="0 0 6 4" fill="none">
                          <path d="M1 2L2.2 3L5 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => onTaskSelect(t)}
                      className={["text-[9px] px-1.5 py-0.5 rounded border truncate max-w-[90px]",
                        t.completed_at ? "border-border/40 text-[#636366] line-through" :
                        t.is_urgent ? "border-danger/40 bg-danger/10 text-danger" :
                        "border-primary/30 bg-primary/10 text-primary",
                      ].join(" ")}
                    >
                      {t.title}
                    </button>
                  </div>
                ))}
                {tasks.length > 2 && (
                  <span className="text-[8px] text-text-secondary self-center">+{tasks.length - 2}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grade horária */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-card">
        <div style={{ height: gridHours.length * HOUR_HEIGHT, position: "relative" }} className="flex">

          {/* Rótulos de hora */}
          <div className="w-12 shrink-0 relative bg-card z-10">
            {gridHours.map((h) => (
              <div
                key={h}
                style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT }}
                className="w-full flex justify-end pr-2"
              >
                <span className="text-[9px] text-text-secondary/50 leading-none -mt-[5px] tabular-nums">
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
                className={["flex-1 relative border-l border-border/30 min-w-0", isToday ? "bg-primary/[0.015]" : ""].join(" ")}
              >
                {gridHours.map((h) => (
                  <div
                    key={h}
                    style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT, left: 0, right: 0 }}
                    className={["border-t", h % 2 === 0 ? "border-border/30" : "border-border/15"].join(" ")}
                  />
                ))}
                {timedTasks.map((t) => (
                  <TaskBlock key={t.id} task={t} onSelect={onTaskSelect} onToggle={onTaskToggle} />
                ))}
              </div>
            );
          })}

          {/* Linha do horário atual */}
          {isCurrentPeriod && nowMinutes >= GRID_START_H * 60 && nowMinutes < GRID_END_H * 60 && (
            <div
              style={{
                position: "absolute",
                top: ((nowMinutes - GRID_START_H * 60) / 60) * HOUR_HEIGHT,
                left: 48,
                right: 0,
                zIndex: 20,
                pointerEvents: "none",
              }}
              className="flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-danger shrink-0 -ml-1 shadow-sm shadow-danger/50" />
              <div className="flex-1 border-t-[1.5px] border-danger shadow-sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Componente principal ── */
export function Calendar() {
  const { tasks, completeTask, uncompleteTask } = useTaskStore();
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

  const goBack    = useCallback(() => setAnchorDate((d) => navigateView(view, d, -1)), [view]);
  const goForward = useCallback(() => setAnchorDate((d) => navigateView(view, d,  1)), [view]);
  const goToday   = useCallback(() => setAnchorDate(today), [today]);

  const handleToggle = useCallback(async (task) => {
    if (task.completed_at) await uncompleteTask(task.id);
    else await completeTask(task.id);
  }, [completeTask, uncompleteTask]);

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e) => {
      const el = e.target;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "d" || k === "1")              { setView("day"); return; }
      if (k === "3")                           { setView("3day"); return; }
      if (k === "u")                           { setView("workweek"); return; }
      if (k === "s" || k === "7")              { setView("week"); return; }
      if (k === "t")                           { goToday(); return; }
      if (k === "arrowleft"  || k === "k")     { goBack(); return; }
      if (k === "arrowright" || k === "j")     { goForward(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, goForward, goToday]);

  const activeDayCount = days.reduce(
    (s, d) => s + (tasksByDay[d] ?? []).filter((t) => !t.completed_at).length, 0
  );

  const monthLabel = formatMonthYear(days[0]).replace(" De ", " de ").replace(" de ", " de ");

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 flex flex-col min-h-0 px-4 pt-5 pb-4 md:px-6">

        {/* Linha 1: título — fica abaixo do botão Foco (absolute top-4 right-4 do Layout) */}
        <h1 className="text-2xl font-semibold text-text-main mb-2 shrink-0">Calendário</h1>

        {/* Linha 2: nav + mês + visões (mr-32 para não colidir com o botão Foco ~120px) */}
        <div className="flex items-center gap-2 mb-1 shrink-0 mr-32">
          <div className="flex items-center gap-0.5">
            <button
              onClick={goBack}
              title="Anterior (← ou K)"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors"
            >‹</button>
            <button
              onClick={goToday}
              title="Hoje (T)"
              className="text-xs px-2.5 py-1 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >Hoje</button>
            <button
              onClick={goForward}
              title="Próximo (→ ou J)"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors"
            >›</button>
          </div>

          <span className="text-sm text-text-secondary capitalize flex-1 min-w-0 truncate">{monthLabel}</span>

          <div className="flex gap-0.5 bg-bg rounded-lg p-0.5 border border-border shrink-0">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                title={`${v.label} (${v.shortcut})`}
                className={["text-[11px] px-2 py-1 rounded-md transition-colors whitespace-nowrap",
                  view === v.id ? "bg-card shadow-sm text-text-main font-medium" : "text-text-secondary hover:text-text-main",
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

        {/* Contador */}
        {activeDayCount > 0 && (
          <p className="text-[11px] text-text-secondary mb-2 shrink-0">
            {activeDayCount} tarefa{activeDayCount !== 1 ? "s" : ""} em aberto neste período
          </p>
        )}

        {/* Timeline — ocupa todo o espaço restante */}
        <MultiDayTimeline
          days={days}
          tasksByDay={tasksByDay}
          today={today}
          onTaskSelect={(t) => setSelectedTask(t)}
          onTaskToggle={handleToggle}
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
