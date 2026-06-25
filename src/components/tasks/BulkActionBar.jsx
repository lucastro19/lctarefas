import { useSelectionStore } from "../../store/selectionStore";
import { useTaskStore } from "../../store/taskStore";

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
      icon: "☀️",
      onClick: async () => { await bulkMoveToToday(selectedIds); clearAll(); },
    },
    {
      label: "Algum Dia",
      icon: "🔮",
      onClick: () => run({ someday: true, scheduled_date: null, scheduled_time: null, archived_at: null }),
    },
    {
      label: "Inbox",
      icon: "📥",
      onClick: () => run({ project_id: null, area_id: null, someday: false, scheduled_date: null, scheduled_time: null }),
    },
    {
      label: "Arquivar",
      icon: "📦",
      onClick: () => run({ archived_at: new Date().toISOString() }),
    },
    {
      label: "Lixeira",
      icon: "🗑️",
      danger: true,
      onClick: () => run({ deleted_at: new Date().toISOString() }),
    },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-1 bg-card border border-border rounded-2xl shadow-xl px-3 py-2">
        <span className="text-xs font-medium text-text-secondary mr-2 pl-1">
          {count} selecionada{count !== 1 ? "s" : ""}
        </span>

        <div className="w-px h-5 bg-border mx-1" />

        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
              action.danger
                ? "text-danger hover:bg-danger/10"
                : "text-text-main hover:bg-bg",
            ].join(" ")}
          >
            <span>{action.icon}</span>
            {action.label}
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
