import { useTaskStore, isDelegatedByMe } from "../../store/taskStore";
import { useAuthStore } from "../../store/authStore";
import { DelegatedRow } from "../delegation/DelegatedRow";
import { TaskCard } from "./TaskCard";

/*
  Painel "Revisar hoje" — cobranças de delegação vencidas + qualquer tarefa (própria ou
  atribuída a mim) com prazo vencido. Fica fora da TimedTaskList de propósito: as delegadas
  não ocupam slot de horário; as demais só ganham um lembrete extra aqui, sem sair de onde já
  estão (Inbox/Hoje/Algum Dia/área/projeto).
*/
export function FollowUpPanel({ onTaskClick }) {
  const { getReviewToday } = useTaskStore();
  const { user } = useAuthStore();
  const due = getReviewToday();

  if (due.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-danger">
          🔎 Revisar hoje
        </h2>
        <span className="text-[11px] font-bold tabular-nums bg-danger text-white rounded-full px-1.5 leading-5">
          {due.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {due.map((task) =>
          isDelegatedByMe(task, user?.id)
            ? <DelegatedRow key={task.id} task={task} onOpen={onTaskClick} />
            : <TaskCard key={task.id} task={task} onClick={() => onTaskClick?.(task)} />
        )}
      </div>
    </section>
  );
}
