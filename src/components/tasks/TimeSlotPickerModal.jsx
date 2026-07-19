import { createPortal } from "react-dom";
import { strToMins, minsToStr, getPeriod, nextSlotInPeriod } from "../../utils/timeSlots";

const PERIODS = [
  { key: "manha", label: "Manhã", icon: "🌅" },
  { key: "tarde", label: "Tarde", icon: "☀️" },
  { key: "noite", label: "Noite", icon: "🌙" },
];

function DayTimeline({ todayTasks, settings }) {
  const ds = strToMins(settings.dayStart);
  const de = strToMins(settings.dayEnd) + 120; // estende 2h após fim do dia
  const total = de - ds;

  const tasksWithTime = todayTasks
    .filter((t) => t.scheduled_time)
    .sort((a, b) => strToMins(a.scheduled_time) - strToMins(b.scheduled_time));

  const pct = (mins) => `${Math.max(0, Math.min(100, ((mins - ds) / total) * 100))}%`;

  // Marcadores de período
  const markers = [
    { mins: strToMins(settings.dayStart),   label: settings.dayStart,   color: "text-primary" },
    { mins: strToMins(settings.lunchStart), label: settings.lunchStart, color: "text-text-secondary" },
    { mins: strToMins(settings.lunchEnd),   label: settings.lunchEnd,   color: "text-text-secondary" },
    { mins: strToMins(settings.dayEnd),     label: settings.dayEnd,     color: "text-warning" },
  ];

  return (
    <div className="mb-4">
      <div className="relative h-6 rounded-full bg-bg overflow-hidden">
        {/* Faixa de almoço */}
        <div
          className="absolute top-0 h-full bg-[#FF9500]/15"
          style={{
            left: pct(strToMins(settings.lunchStart)),
            width: pct(strToMins(settings.lunchEnd)) === pct(strToMins(settings.lunchStart))
              ? "0%" : `calc(${pct(strToMins(settings.lunchEnd))} - ${pct(strToMins(settings.lunchStart))})`,
          }}
        />
        {/* Tarefas */}
        {tasksWithTime.map((t) => {
          const start = strToMins(t.scheduled_time);
          const dur = t.duration_minutes ?? settings.defaultDurationMinutes;
          return (
            <div
              key={t.id}
              title={`${t.scheduled_time} — ${t.title}`}
              className="absolute top-1 h-4 rounded-sm bg-primary/70"
              style={{
                left: pct(start),
                width: `max(4px, calc(${pct(start + dur)} - ${pct(start)}))`,
              }}
            />
          );
        })}
        {/* Marcadores de horário */}
        {markers.map((m) => (
          <div
            key={m.mins}
            className="absolute top-0 h-full w-px bg-border/60"
            style={{ left: pct(m.mins) }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="relative h-4 mt-0.5">
        {markers.map((m) => (
          <span
            key={m.mins}
            className={`absolute text-[9px] ${m.color} -translate-x-1/2`}
            style={{ left: pct(m.mins) }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TimeSlotPickerModal({ task, todayTasks, settings, onPick, onClose }) {
  const { defaultDurationMinutes } = settings;
  const tasksWithTime = todayTasks.filter((t) => t.scheduled_time && t.id !== task.id);

  const periodData = PERIODS.map((p) => {
    const tasks = tasksWithTime
      .filter((t) => getPeriod(t.scheduled_time, settings) === p.key)
      .sort((a, b) => strToMins(a.scheduled_time) - strToMins(b.scheduled_time));
    const slot = nextSlotInPeriod(p.key, tasks, settings, defaultDurationMinutes);
    return { ...p, tasks, slot };
  });

  const allFull = periodData.every((p) => p.slot.full);

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] bg-black/50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-t-2xl md:rounded-2xl w-full max-w-sm px-4 pt-4 pb-safe-bottom md:pb-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {/* Handle bar (mobile) */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3 md:hidden" />

        <h3 className="text-base font-semibold text-text-main mb-0.5">Agenda de hoje</h3>
        <p className="text-xs text-text-secondary mb-4">
          {allFull ? "Dia completo — escolha um horário manualmente." : "Manhã cheia — escolha outro período."}
        </p>

        {/* Mini timeline */}
        <DayTimeline todayTasks={tasksWithTime} settings={settings} />

        {/* Períodos */}
        <div className="space-y-3">
          {periodData.map((period) => (
            <div key={period.key} className="bg-bg rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{period.icon}</span>
                  <span className="text-xs font-semibold text-text-main">{period.label}</span>
                  <span className="text-[10px] text-text-secondary">
                    {period.tasks.length > 0
                      ? `${period.tasks.length} tarefa${period.tasks.length !== 1 ? "s" : ""}`
                      : "livre"}
                  </span>
                </div>
                {period.slot.full ? (
                  <span className="text-[10px] font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                    Cheio
                  </span>
                ) : (
                  <button
                    onClick={() => onPick(period.slot.time)}
                    className="text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3 py-1 rounded-lg transition-colors"
                  >
                    {period.slot.time}
                  </button>
                )}
              </div>

              {/* Tarefas do período */}
              {period.tasks.length > 0 && (
                <div className="space-y-0.5 ml-1">
                  {period.tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary w-10 shrink-0 font-mono">
                        {t.scheduled_time}
                      </span>
                      <div
                        className="h-1 rounded-full bg-primary/40 shrink-0"
                        style={{ width: `${Math.min((t.duration_minutes ?? defaultDurationMinutes) / 60 * 48, 80)}px` }}
                      />
                      <span className="text-[10px] text-text-secondary truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-sm text-text-secondary hover:text-text-main transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body
  );
}
