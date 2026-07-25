import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useOrgStore } from "../store/orgStore";
import { useTaskStore } from "../store/taskStore";
import { TaskList } from "../components/tasks/TaskList";
import { TaskDetail } from "../components/tasks/TaskDetail";

function fmtShortDate(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

// Linha somente-leitura pra tarefa de colega no mesmo espaço — virar membro do espaço só dá
// visibilidade (RLS), editar continua exclusivo de quem é dono/assignee da tarefa (ver
// migration_org_spaces.sql). Mesmo espírito do TeamTaskRow do Cockpit.
function ColleagueTaskRow({ task, ownerName, demandType }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-card bg-card border border-border min-w-0">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-text-main truncate leading-tight">{task.title}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-text-secondary shrink-0">{ownerName}</span>
          {demandType && (
            <span
              className="text-[10px] font-medium leading-none px-1.5 py-0.5 rounded-full shrink-0"
              style={{ color: demandType.color, backgroundColor: demandType.color + "22" }}
            >
              {demandType.label}
            </span>
          )}
          {task.deadline && (
            <span className="text-[10px] text-text-secondary shrink-0">🚨 {fmtShortDate(task.deadline)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function SpacePage() {
  const { id } = useParams();
  const { spaces, getMemberByUserId, demandTypes, fetchSpaceTasks } = useOrgStore();
  const { getBySpace, getCompletedBySpace } = useTaskStore();
  const [selectedTask, setSelectedTask] = useState(null);
  const [colleagueTasks, setColleagueTasks] = useState([]);

  const space = spaces.find((s) => s.id === id);

  useEffect(() => {
    if (space) fetchSpaceTasks(id).then(setColleagueTasks);
  }, [id, space]);

  if (!space) return <div className="p-8 text-text-secondary text-sm">Espaço não encontrado.</div>;

  const myTasks = getBySpace(id);
  const myCompleted = getCompletedBySpace(id);

  return (
    <div className="flex h-full" onClick={() => setSelectedTask(null)}>
      <div className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: space.color }} />
          <h1 className="text-2xl font-semibold text-text-main truncate">{space.name}</h1>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          {space.is_open ? "Espaço aberto — toda a organização vê o que está aqui." : "Espaço fechado — só quem tem acesso."}
        </p>

        <TaskList
          tasks={myTasks}
          completedTasks={myCompleted}
          defaultFields={{ space_id: id }}
          onTaskClick={setSelectedTask}
          emptyMessage="Nenhuma tarefa sua neste espaço ainda."
        />

        {colleagueTasks.length > 0 && (
          <section className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary px-1 pb-2">
              Da equipe
            </p>
            <div className="space-y-1.5">
              {colleagueTasks.map((t) => (
                <ColleagueTaskRow
                  key={t.id}
                  task={t}
                  ownerName={getMemberByUserId(t.assignee_id ?? t.user_id)?.profile?.full_name?.split(" ")[0] ?? "?"}
                  demandType={t.demand_type_id ? demandTypes.find((d) => d.id === t.demand_type_id) : null}
                />
              ))}
            </div>
          </section>
        )}
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
