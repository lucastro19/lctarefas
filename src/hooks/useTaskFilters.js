import { useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useOrgStore } from "../store/orgStore";
import { useCollaboratorStore } from "../store/collaboratorStore";
import { memberDisplayName } from "../components/delegation/shared";

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

// Filtro + agrupar + ordenar (Fase 4.4) — tudo client-side sobre o array de tarefas já
// carregado da página (sem fetch novo). Pensado pra Área/Projeto/Espaço, onde o "Pessoa" só
// importa de verdade quando há mais de uma pessoa envolvida (organização/espaço).
export function useTaskFilters(tasks) {
  const { user } = useAuthStore();
  const { members, demandTypes } = useOrgStore();
  const { collaborators } = useCollaboratorStore();

  const [personFilter, setPersonFilter] = useState([]); // vazio = todas
  const [typeFilter, setTypeFilter] = useState([]); // vazio = todos
  const [lateOnly, setLateOnly] = useState(false);
  const [sortBy, setSortBy] = useState("none"); // none | deadline | priority | aging
  const [groupBy, setGroupBy] = useState("status"); // status | person | type

  const personLabel = (userId) => {
    if (!userId) return "Sem responsável";
    if (userId === user?.id) return "Eu";
    const member = members.find((m) => m.user_id === userId);
    return member ? memberDisplayName(member, collaborators) : "Alguém";
  };

  const people = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.assignee_id ?? t.user_id).filter(Boolean))];
    return ids.map((id) => ({ id, label: personLabel(id) }));
  }, [tasks, members, collaborators, user]);

  const types = useMemo(() => {
    const ids = [...new Set(tasks.map((t) => t.demand_type_id).filter(Boolean))];
    return ids.map((id) => demandTypes.find((d) => d.id === id)).filter(Boolean);
  }, [tasks, demandTypes]);

  const today = localDateStr();

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => {
      const person = t.assignee_id ?? t.user_id;
      if (personFilter.length > 0 && !personFilter.includes(person)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(t.demand_type_id)) return false;
      if (lateOnly && !(t.deadline && t.deadline < today && !t.completed_at)) return false;
      return true;
    });

    if (sortBy !== "none") {
      list = [...list].sort((a, b) => {
        if (sortBy === "priority") return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
        if (sortBy === "aging") {
          const da = a.created_at ? new Date(a.created_at) : new Date();
          const db = b.created_at ? new Date(b.created_at) : new Date();
          return da - db; // criada há mais tempo primeiro (mais parada)
        }
        // deadline: sem prazo vai pro final
        return (a.deadline ?? "9999-99-99").localeCompare(b.deadline ?? "9999-99-99");
      });
    }

    return list;
  }, [tasks, personFilter, typeFilter, lateOnly, sortBy, today]);

  return {
    filtered, people, types, personLabel,
    personFilter, setPersonFilter, typeFilter, setTypeFilter,
    lateOnly, setLateOnly, sortBy, setSortBy, groupBy, setGroupBy,
  };
}
