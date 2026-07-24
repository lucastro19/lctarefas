import { useState, useRef, useEffect } from "react";
import { useSelectionStore } from "../../store/selectionStore";
import { useTaskStore } from "../../store/taskStore";
import { useCollaboratorStore } from "../../store/collaboratorStore";
import { CollaboratorAvatar, inDays } from "../delegation/shared";

const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
);

const IconClock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const IconInbox = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
  </svg>
);

const IconArchive = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconHandshake = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12l-4-4-3 3-2-2-3 3-4-4"/><path d="M2 8v6l6 6 2-2 2 2 2-2 2 2 6-6V8"/>
  </svg>
);

export function BulkActionBar() {
  const { selectedIds, clearAll } = useSelectionStore();
  const { bulkUpdate, bulkMoveToToday, delegateTask } = useTaskStore();
  const { collaborators } = useCollaboratorStore();
  const [showDelegate, setShowDelegate] = useState(false);
  const delegateRef = useRef(null);

  useEffect(() => {
    if (!showDelegate) return;
    const handler = (e) => {
      if (delegateRef.current && !delegateRef.current.contains(e.target)) setShowDelegate(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showDelegate]);

  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  if (selectedIds.length === 0) return null;

  const count = selectedIds.length;

  const run = async (fields) => {
    await bulkUpdate(selectedIds, fields);
    clearAll();
  };

  const actions = [
    {
      label: "Hoje",
      icon: <IconSun />,
      onClick: async () => { await bulkMoveToToday(selectedIds); clearAll(); },
    },
    {
      label: "Amanhã",
      icon: <IconCalendar />,
      onClick: () => run({ scheduled_date: tomorrow(), someday: false, archived_at: null }),
    },
    {
      label: "Depois",
      icon: <IconClock />,
      onClick: () => run({ someday: true, scheduled_date: null, scheduled_time: null, archived_at: null }),
    },
    {
      label: "Inbox",
      icon: <IconInbox />,
      onClick: () => run({ project_id: null, area_id: null, someday: false, scheduled_date: null, scheduled_time: null }),
    },
    {
      label: "Delegar",
      icon: <IconHandshake />,
      onClick: () => setShowDelegate((v) => !v),
      disabled: collaborators.length === 0,
    },
    {
      label: "Arquivar",
      icon: <IconArchive />,
      onClick: () => run({ archived_at: new Date().toISOString() }),
    },
    {
      label: "Lixeira",
      icon: <IconTrash />,
      danger: true,
      onClick: () => run({ deleted_at: new Date().toISOString() }),
    },
  ];

  return (
    <div className="fixed bottom-20 md:bottom-6 left-2 right-2 md:left-auto md:right-auto md:w-auto md:translate-x-0 md:left-1/2 z-50 pointer-events-none flex justify-center">
      <div className="pointer-events-auto relative flex items-center bg-card border border-border rounded-2xl shadow-xl px-2 py-1.5 gap-0.5 w-full md:w-auto">
        {showDelegate && (
          <div
            ref={delegateRef}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl py-1 min-w-[190px] max-h-56 overflow-y-auto"
          >
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              Delegar {count} tarefa{count !== 1 ? "s" : ""} para
            </p>
            {collaborators.map((c) => (
              <button
                key={c.id}
                onClick={async () => {
                  // Fase 2.7: delegação em massa precisa passar pela mesma RPC
                  // que a delegação individual — bulkUpdate escreveria os
                  // campos direto na tabela, sem criar o elo em
                  // task_delegations (quebrando aceite/cobrança depois).
                  await Promise.all(
                    selectedIds.map((id) => delegateTask(id, { collaboratorId: c.id, followUpDate: inDays(3) }))
                  );
                  clearAll();
                  setShowDelegate(false);
                }}
                className="menu-item w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
              >
                <CollaboratorAvatar collaborator={c} size={20} />
                <span className="flex-1 truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
        {/* Contagem */}
        <span className="text-xs font-medium text-text-secondary px-2 shrink-0">
          <span className="md:hidden">{count} sel.</span>
          <span className="hidden md:inline">{count} selecionada{count !== 1 ? "s" : ""}</span>
        </span>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* Ações */}
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.disabled ? "Cadastre um colaborador primeiro" : action.label}
            className={[
              "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors flex-1 md:flex-none md:px-3 md:min-w-[52px]",
              action.disabled
                ? "text-text-secondary/30 cursor-not-allowed"
                : action.danger
                  ? "text-danger hover:bg-danger/10"
                  : "text-text-main hover:bg-bg",
            ].join(" ")}
          >
            {action.icon}
            <span className="text-[9px] md:text-[10px] font-medium leading-none">{action.label}</span>
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* Fechar */}
        <button
          onClick={clearAll}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors text-text-secondary hover:text-text-main shrink-0"
        >
          <span className="text-sm leading-none">✕</span>
          <span className="text-[9px] md:text-[10px] font-medium leading-none">Cancelar</span>
        </button>
      </div>
    </div>
  );
}
