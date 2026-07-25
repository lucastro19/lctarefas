import { useMemo, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useOrgStore } from "../store/orgStore";
import { useCollaboratorStore } from "../store/collaboratorStore";
import { memberDisplayName } from "../components/delegation/shared";

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const viewsKey = (storageKey) => `lc_savedviews_${storageKey}`;

function readViews(storageKey) {
  if (!storageKey) return [];
  try {
    return JSON.parse(localStorage.getItem(viewsKey(storageKey)) ?? "[]");
  } catch {
    return [];
  }
}

// Filtro + agrupar + ordenar (Fase 4.4) — tudo client-side sobre o array de tarefas já
// carregado da página (sem fetch novo). Pensado pra Área/Projeto/Espaço, onde o "Pessoa" só
// importa de verdade quando há mais de uma pessoa envolvida (organização/espaço).
// `storageKey` (Fase 4.5) identifica a página pra guardar Views salvas — ex.: `area_<id>`.
export function useTaskFilters(tasks, storageKey) {
  const { user } = useAuthStore();
  const { members, demandTypes } = useOrgStore();
  const { collaborators } = useCollaboratorStore();

  const [personFilter, setPersonFilter] = useState([]); // vazio = todas
  const [typeFilter, setTypeFilter] = useState([]); // vazio = todos
  const [lateOnly, setLateOnly] = useState(false);
  const [sortBy, setSortBy] = useState("none"); // none | deadline | priority | aging
  const [groupBy, setGroupBy] = useState("status"); // status | person | type
  const [savedViews, setSavedViews] = useState(() => readViews(storageKey));

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

  // "Só minhas" (Fase 4.5) — atalho de 1 clique pra isolar Pessoa = eu, sem abrir o grupo de
  // pessoa toda vez. Clicar de novo com o filtro já em "só eu" restaura todo mundo.
  const isMineActive = personFilter.length === 1 && personFilter[0] === user?.id;
  const toggleMine = () => {
    if (!user?.id) return;
    setPersonFilter(isMineActive ? [] : [user.id]);
  };

  // Views salvas (Fase 4.5) — combinação de filtros guardada por página, sem tabela nova.
  const saveCurrentView = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedViews((prev) => {
      const next = [...prev.filter((v) => v.name !== trimmed), { name: trimmed, personFilter, typeFilter, lateOnly }];
      if (storageKey) localStorage.setItem(viewsKey(storageKey), JSON.stringify(next));
      return next;
    });
  };
  const applyView = (view) => {
    setPersonFilter(view.personFilter ?? []);
    setTypeFilter(view.typeFilter ?? []);
    setLateOnly(!!view.lateOnly);
  };
  const deleteView = (name) => {
    setSavedViews((prev) => {
      const next = prev.filter((v) => v.name !== name);
      if (storageKey) localStorage.setItem(viewsKey(storageKey), JSON.stringify(next));
      return next;
    });
  };

  return {
    filtered, people, types, personLabel,
    personFilter, setPersonFilter, typeFilter, setTypeFilter,
    lateOnly, setLateOnly, sortBy, setSortBy, groupBy, setGroupBy,
    isMineActive, toggleMine,
    savedViews, saveCurrentView, applyView, deleteView,
  };
}
