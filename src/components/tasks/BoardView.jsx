import { useMemo } from "react";
import { STATUS_META, STATUS_ORDER } from "../delegation/shared";

const SIMPLE_COLUMNS = [
  { key: "aberta", label: "A fazer" },
  { key: "concluida", label: "Concluída", color: STATUS_META.concluida.color },
];

// Colunas = delegation_status quando há tarefa de org/espaço no conjunto (dado que já existe);
// em área 100% pessoal (sem org_id em nenhuma tarefa) cai pro fallback simples de 2 colunas —
// não existe "status" leve pra tarefa pessoal ainda (decisão explícita do Lucas, Fase 4).
function boardStatus(task) {
  if (task.completed_at) return "concluida";
  return task.delegation_status ?? "pendente";
}

export function BoardView({ tasks, onTaskClick }) {
  const hasOrgData = tasks.some((t) => t.org_id);

  const columns = useMemo(() => {
    if (hasOrgData) {
      return [...STATUS_ORDER, "concluida"].map((key) => ({
        key, label: STATUS_META[key].label, color: STATUS_META[key].color,
      }));
    }
    return SIMPLE_COLUMNS;
  }, [hasOrgData]);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map((c) => [c.key, []]));
    tasks.forEach((t) => {
      const key = hasOrgData ? boardStatus(t) : (t.completed_at ? "concluida" : "aberta");
      (map[key] ?? map[columns[0].key]).push(t);
    });
    return map;
  }, [tasks, columns, hasOrgData]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="w-64 shrink-0 bg-bg rounded-xl p-2.5">
          <div className="flex items-center gap-2 px-1 pb-2">
            {col.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />}
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary truncate">{col.label}</span>
            <span className="ml-auto text-[10px] font-bold text-text-secondary tabular-nums shrink-0">
              {grouped[col.key]?.length ?? 0}
            </span>
          </div>
          <div className="space-y-1.5">
            {(grouped[col.key] ?? []).map((t) => (
              <button
                key={t.id}
                onClick={() => onTaskClick(t)}
                className="w-full text-left bg-card border border-border rounded-lg px-2.5 py-2 text-[12.5px] text-text-main hover:border-primary/40 transition-colors"
              >
                {t.title}
              </button>
            ))}
            {(grouped[col.key] ?? []).length === 0 && (
              <p className="text-[11px] text-text-secondary/40 px-1 py-2">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
