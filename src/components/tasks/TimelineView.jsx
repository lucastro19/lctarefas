import { useMemo } from "react";

const DAYS = 14;
const DAY_MS = 86400000;

// Linha do tempo por Área/Projeto/Espaço (Fase 4.3) — janela fixa dos próximos 14 dias, barras
// de scheduled_date→deadline. Não substitui o Calendário (que é global/de urgentes); isso é um
// recorte por página. Tarefa sem nenhuma data fica de fora, igual ao mockup.
export function TimelineView({ tasks, onTaskClick }) {
  const start = useMemo(() => {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    return s;
  }, []);

  const days = useMemo(
    () => Array.from({ length: DAYS }, (_, i) => new Date(start.getTime() + i * DAY_MS)),
    [start]
  );

  const dated = useMemo(() => {
    return tasks
      .filter((t) => t.scheduled_date || t.deadline)
      .map((t) => {
        const from = t.scheduled_date ? new Date(t.scheduled_date + "T00:00:00") : new Date(t.deadline + "T00:00:00");
        const to = t.deadline ? new Date(t.deadline + "T00:00:00") : from;
        return { task: t, from: from < to ? from : to, to: to > from ? to : from };
      })
      .filter(({ to }) => to >= start)
      .sort((a, b) => a.from - b.from);
  }, [tasks, start]);

  if (dated.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-8 text-center">
        Nenhuma tarefa com data nos próximos {DAYS} dias.
      </p>
    );
  }

  const dayWidth = 100 / DAYS;
  const offset = (d) => Math.max(0, Math.min(DAYS - 1, Math.round((d - start) / DAY_MS)));

  return (
    <div className="space-y-2">
      <div
        className="grid text-[10px] text-text-secondary border-b border-border pb-1.5 mb-1"
        style={{ gridTemplateColumns: `140px repeat(${DAYS}, 1fr)` }}
      >
        <span />
        {days.map((d, i) => (
          <span key={i} className="text-center capitalize">
            {d.toLocaleDateString("pt-BR", { weekday: "narrow" })}
          </span>
        ))}
      </div>
      {dated.map(({ task, from, to }) => {
        const left = offset(from) * dayWidth;
        const width = Math.max(dayWidth, (offset(to) - offset(from) + 1) * dayWidth);
        return (
          <div key={task.id} className="grid items-center gap-0" style={{ gridTemplateColumns: "140px 1fr" }}>
            <span className="text-[12px] text-text-main truncate pr-2">{task.title}</span>
            <div className="relative h-5 bg-bg rounded">
              <button
                onClick={() => onTaskClick(task)}
                title={task.title}
                className="absolute top-0.5 h-4 rounded-full hover:opacity-80 transition-opacity"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: task.is_urgent ? "#FF3B30" : "#4F8EF7" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
