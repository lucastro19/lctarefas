import { useTaskStore } from "../../store/taskStore";
import { DelegatedRow } from "../delegation/DelegatedRow";

/*
  Painel "Cobrar hoje" — tarefas delegadas cuja data de follow-up chegou.
  Fica fora da TimedTaskList de propósito: delegadas não ocupam slot de horário,
  então não entram no cálculo sequencial do dia.
*/
export function FollowUpPanel({ onTaskClick }) {
  const { getFollowUpsDue } = useTaskStore();
  const due = getFollowUpsDue();

  if (due.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-danger">
          🤝 Cobrar hoje
        </h2>
        <span className="text-[11px] font-bold tabular-nums bg-danger text-white rounded-full px-1.5 leading-5">
          {due.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {due.map((task) => (
          <DelegatedRow key={task.id} task={task} onOpen={onTaskClick} />
        ))}
      </div>
    </section>
  );
}
