import { useSelectionStore } from "../../store/selectionStore";
import { useTaskStore } from "../../store/taskStore";

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

export function BulkActionBar() {
  const { selectedIds, clearAll } = useSelectionStore();
  const { bulkUpdate, bulkMoveToToday } = useTaskStore();

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
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 bg-card border border-border rounded-2xl shadow-xl px-3 py-2">
        <span className="text-xs font-medium text-text-secondary mr-2 pl-1">
          {count} selecionada{count !== 1 ? "s" : ""}
        </span>

        <div className="w-px h-5 bg-border mx-1" />

        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            title={action.label}
            className={[
              "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-colors min-w-[44px]",
              action.danger
                ? "text-danger hover:bg-danger/10"
                : "text-text-main hover:bg-bg",
            ].join(" ")}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={clearAll}
          className="text-text-secondary hover:text-text-main px-2 py-1.5 rounded-xl transition-colors text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
