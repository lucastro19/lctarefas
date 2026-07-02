import { useState, useRef, useEffect } from "react";
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

function weekStart(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
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

const HOUR_HEIGHT = 64; // px por hora
const GRID_START_H = 6; // 06:00
const GRID_END_H = 23;  // 23:00

const hours = Array.from({ length: GRID_END_H - GRID_START_H }, (_, i) => GRID_START_H + i);

/* ── Indicador de carga ── */
function LoadBar({ tasks }) {
  const totalMinutes = tasks.reduce((s, t) => s + (t.duration_minutes ?? 30), 0);
  const totalHours = totalMinutes / 60;
  const pct = Math.min(100, (totalHours / 8) * 100);
  const color = totalHours < 3 ? "#34C759" : totalHours < 6 ? "#FF9500" : "#FF3B30";
  return (
    <div className="mx-2 mb-1 h-1 rounded-full bg-border/40 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

/* ── Bloco de tarefa na timeline ── */
function TaskBlock({ task, gridStartH, onSelect }) {
  const startMin = timeToMinutes(task.scheduled_time) ?? (gridStartH * 60);
  const duration = task.duration_minutes ?? 30;
  const top = ((startMin - gridStartH * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(24, (duration / 60) * HOUR_HEIGHT);

  const isUrgent = task.is_urgent && !task.completed_at;
  const isDone = !!task.completed_at;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(task); }}
      style={{ position: "absolute", top, left: 4, right: 4, height }}
      className={[
        "rounded-lg px-2 py-1 cursor-pointer overflow-hidden transition-opacity hover:opacity-90 select-none",
        isDone ? "bg-border/40 opacity-50" : isUrgent ? "bg-danger/15 border border-danger/30" : "bg-primary/15 border border-primary/20",
      ].join(" ")}
    >
      <p className={["text-[11px] font-medium leading-tight truncate", isDone ? "line-through text-text-secondary" : isUrgent ? "text-danger" : "text-primary"].join(" ")}>
        {task.title}
      </p>
      {height > 36 && (
        <p className="text-[10px] text-text-secondary leading-none mt-0.5">
          {task.scheduled_time?.slice(0, 5)} · {duration}min
        </p>
      )}
    </div>
  );
}

/* ── View: Timeline do dia ── */
function DayTimeline({ dateStr, tasks, onTaskSelect, onBack }) {
  const scrollRef = useRef(null);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStr = localDateStr();
  const isToday = dateStr === todayStr;

  const timedTasks = tasks.filter((t) => t.scheduled_time);
  const untimedTasks = tasks.filter((t) => !t.scheduled_time);

  useEffect(() => {
    if (scrollRef.current) {
      const targetMin = isToday ? nowMinutes : GRID_START_H * 60 + 60;
      const offset = ((targetMin - GRID_START_H * 60) / 60) * HOUR_HEIGHT - 80;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, [dateStr]);

  const d = new Date(dateStr + "T12:00:00");
  const label = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0 border-b border-border">
        <button
          onClick={onBack}
          className="text-primary text-sm font-medium flex items-center gap-1 hover:opacity-70 transition-opacity"
        >
          ← Semana
        </button>
        <h2 className="text-sm font-semibold text-text-main capitalize flex-1">{label}</h2>
      </div>

      {/* Tarefas sem horário */}
      {untimedTasks.length > 0 && (
        <div className="px-4 py-2 border-b border-border/50 shrink-0">
          <p className="text-[10px] text-text-secondary font-medium uppercase tracking-wide mb-1.5">Sem horário</p>
          <div className="flex flex-wrap gap-1.5">
            {untimedTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onTaskSelect(t)}
                className={[
                  "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  t.completed_at ? "border-border text-text-secondary line-through" :
                  t.is_urgent ? "border-danger/40 bg-danger/10 text-danger" :
                  "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
                ].join(" ")}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grade de horas */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div
          style={{ height: hours.length * HOUR_HEIGHT, position: "relative" }}
          className="pl-12 pr-2"
        >
          {/* Linhas de hora */}
          {hours.map((h) => (
            <div
              key={h}
              style={{ position: "absolute", top: (h - GRID_START_H) * HOUR_HEIGHT, left: 0, right: 0 }}
              className="flex items-start"
            >
              <span className="w-10 text-right text-[10px] text-text-secondary/70 pr-2 leading-none -mt-[6px] shrink-0">
                {String(h).padStart(2, "0")}:00
              </span>
              <div className="flex-1 border-t border-border/40" />
            </div>
          ))}

          {/* Linha do horário atual */}
          {isToday && nowMinutes >= GRID_START_H * 60 && nowMinutes < GRID_END_H * 60 && (
            <div
              style={{
                position: "absolute",
                top: ((nowMinutes - GRID_START_H * 60) / 60) * HOUR_HEIGHT,
                left: 40,
                right: 0,
                zIndex: 10,
              }}
              className="flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-danger shrink-0 -ml-1" />
              <div className="flex-1 border-t-2 border-danger" />
            </div>
          )}

          {/* Blocos de tarefas */}
          {timedTasks.map((t) => (
            <TaskBlock key={t.id} task={t} gridStartH={GRID_START_H} onSelect={onTaskSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── View: Grade da semana ── */
function WeekGrid({ days, today, tasksByDay, onDayClick, onTaskSelect }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
      {days.map((dateStr) => {
        const isToday = dateStr === today;
        const dayTasks = tasksByDay[dateStr] ?? [];
        const activeTasks = dayTasks.filter((t) => !t.completed_at);
        const d = new Date(dateStr + "T12:00:00");
        const dayNum = d.getDate();
        const dayLabel = formatDayLabel(dateStr);

        return (
          <div
            key={dateStr}
            className={[
              "flex flex-col rounded-xl border transition-colors cursor-pointer group",
              isToday ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30",
            ].join(" ")}
            onClick={() => onDayClick(dateStr)}
          >
            {/* Cabeçalho do dia */}
            <div className={["flex flex-col items-center pt-2 pb-1 border-b border-border/50 shrink-0", isToday ? "border-primary/20" : ""].join(" ")}>
              <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">{dayLabel}</span>
              <span className={["w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mt-0.5 transition-colors", isToday ? "bg-primary text-white" : "text-text-main group-hover:bg-primary/10"].join(" ")}>
                {dayNum}
              </span>
            </div>

            {/* Indicador de carga */}
            <LoadBar tasks={activeTasks} />

            {/* Chips de tarefas */}
            <div className="flex-1 overflow-y-auto px-1 pb-1 space-y-0.5 min-h-0">
              {dayTasks.slice(0, 7).map((task) => (
                <button
                  key={task.id}
                  onClick={(e) => { e.stopPropagation(); onTaskSelect(task); }}
                  className={[
                    "w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded-md transition-colors",
                    task.completed_at
                      ? "line-through text-text-secondary bg-border/20"
                      : task.is_urgent
                      ? "bg-danger/10 text-danger font-medium"
                      : "bg-primary/10 text-primary hover:bg-primary/20",
                  ].join(" ")}
                >
                  {task.scheduled_time && (
                    <span className="opacity-60 mr-1">{task.scheduled_time.slice(0, 5)}</span>
                  )}
                  <span className="truncate block">{task.title}</span>
                </button>
              ))}
              {dayTasks.length > 7 && (
                <p className="text-[10px] text-text-secondary text-center pb-0.5">
                  +{dayTasks.length - 7} mais
                </p>
              )}
              {dayTasks.length === 0 && (
                <p className="text-[10px] text-text-secondary/40 text-center py-2">—</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Componente principal ── */
export function Calendar() {
  const { tasks } = useTaskStore();
  const [view, setView] = useState("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(localDateStr());
  const [selectedTask, setSelectedTask] = useState(null);

  const today = localDateStr();
  const monday = weekStart(addDays(today, weekOffset * 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const tasksByDay = tasks.reduce((acc, t) => {
    if (!t.scheduled_date || t.deleted_at) return acc;
    if (!acc[t.scheduled_date]) acc[t.scheduled_date] = [];
    acc[t.scheduled_date].push(t);
    return acc;
  }, {});

  const dayTasks = tasksByDay[selectedDate] ?? [];

  const handleDayClick = (dateStr) => {
    setSelectedDate(dateStr);
    setView("day");
  };

  const monthLabel = formatMonthYear(view === "week" ? monday : selectedDate);

  const goBack = () => {
    const prev = addDays(selectedDate, -1);
    if (!days.includes(prev)) setWeekOffset((w) => w - 1);
    setSelectedDate(prev);
  };

  const goForward = () => {
    const next = addDays(selectedDate, 1);
    if (!days.includes(next)) setWeekOffset((w) => w + 1);
    setSelectedDate(next);
  };

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 flex flex-col px-4 py-6 md:px-6 md:py-6 min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-main">Calendário</h1>
            <div className="flex gap-1 bg-bg rounded-lg p-0.5 border border-border">
              <button
                onClick={() => setView("week")}
                className={["text-xs px-2.5 py-1 rounded-md transition-colors", view === "week" ? "bg-card shadow-sm text-text-main font-medium" : "text-text-secondary hover:text-text-main"].join(" ")}
              >
                Semana
              </button>
              <button
                onClick={() => { setView("day"); setSelectedDate(today); }}
                className={["text-xs px-2.5 py-1 rounded-md transition-colors", view === "day" ? "bg-card shadow-sm text-text-main font-medium" : "text-text-secondary hover:text-text-main"].join(" ")}
              >
                Dia
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => view === "week" ? setWeekOffset((w) => w - 1) : goBack()}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors"
            >‹</button>
            <button
              onClick={() => { setWeekOffset(0); setSelectedDate(today); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={() => view === "week" ? setWeekOffset((w) => w + 1) : goForward()}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card text-text-secondary hover:text-text-main transition-colors"
            >›</button>
          </div>
        </div>

        <p className="text-sm text-text-secondary mb-4 capitalize shrink-0">{monthLabel}</p>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0">
          {view === "week" ? (
            <WeekGrid
              days={days}
              today={today}
              tasksByDay={tasksByDay}
              onDayClick={handleDayClick}
              onTaskSelect={(t) => { setSelectedTask(t); }}
            />
          ) : (
            <DayTimeline
              dateStr={selectedDate}
              tasks={dayTasks}
              onTaskSelect={(t) => setSelectedTask(t)}
              onBack={() => setView("week")}
            />
          )}
        </div>
      </div>

      {/* Painel lateral de detalhe */}
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
