import { createPortal } from "react-dom";
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useTaskStore } from "../../store/taskStore";

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 08h–18h

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DraggableChip({ task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={[
        "bg-bg border border-border rounded-lg px-2.5 py-2 text-[12.5px] text-text-main mb-1.5 cursor-grab select-none touch-none",
        isDragging ? "opacity-40 z-10 relative" : "",
      ].join(" ")}
    >
      {task.title}
    </div>
  );
}

function HourSlot({ hour, task }) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour-${hour}` });
  return (
    <div
      ref={setNodeRef}
      className={[
        "flex items-center gap-2 min-h-[34px] border-b border-dashed border-border px-1 rounded transition-colors",
        isOver ? "bg-primary/8" : "",
      ].join(" ")}
    >
      <span className="w-11 shrink-0 text-[11px] font-semibold text-text-secondary">{String(hour).padStart(2, "0")}:00</span>
      {task && (
        <div className="flex-1 min-w-0 text-[12px] text-text-main bg-card border border-border rounded-lg px-2 py-1 truncate">
          {task.title}
        </div>
      )}
    </div>
  );
}

// Arrastar tarefa pro horário certo (Fase 4.9, estilo Akiflow/Motion) — DndContext isolado desse
// modal, sem interferir no DnD global do app (Layout.jsx). Só mexe em scheduled_time, mesma
// mutação que o resto do app já usa.
export function TimeSlotPlanner({ onClose }) {
  const { getToday, updateTask } = useTaskStore();
  const today = todayStr();
  const todayTasks = getToday().filter((t) => t.scheduled_date === today);
  const unscheduled = todayTasks.filter((t) => !t.scheduled_time);

  const scheduledByHour = {};
  todayTasks.filter((t) => t.scheduled_time).forEach((t) => {
    const h = Number(t.scheduled_time.slice(0, 2));
    if (!scheduledByHour[h]) scheduledByHour[h] = t;
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = ({ active, over }) => {
    if (!over) return;
    const match = String(over.id).match(/^hour-(\d+)$/);
    if (!match) return;
    const hour = String(match[1]).padStart(2, "0");
    updateTask(active.id, { scheduled_time: `${hour}:00` });
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[82vh] flex flex-col"
      >
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h2 className="text-[17px] font-semibold text-text-main">Organizar horários de hoje</h2>
          <p className="text-[13px] text-text-secondary mt-1">Arraste uma tarefa sem horário pro slot certo.</p>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-y-auto px-5 py-4 flex gap-4">
            <div className="w-36 shrink-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-secondary mb-2">Sem horário</p>
              {unscheduled.length === 0 ? (
                <p className="text-[11px] text-text-secondary/50">Tudo agendado ✅</p>
              ) : (
                unscheduled.map((t) => <DraggableChip key={t.id} task={t} />)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-secondary mb-2">Hoje</p>
              {HOURS.map((h) => (
                <HourSlot key={h} hour={h} task={scheduledByHour[h]} />
              ))}
            </div>
          </div>
        </DndContext>

        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
