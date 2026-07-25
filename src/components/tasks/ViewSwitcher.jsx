const OPTIONS = [
  { id: "list", icon: "☰", label: "Lista" },
  { id: "board", icon: "▦", label: "Board" },
  { id: "timeline", icon: "📈", label: "Linha do tempo" },
];

export function ViewSwitcher({ mode, onChange }) {
  return (
    <div className="inline-flex gap-0.5 bg-bg border border-border rounded-lg p-0.5 shrink-0">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={[
            "px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5",
            mode === o.id ? "bg-card text-text-main shadow-sm" : "text-text-secondary hover:text-text-main",
          ].join(" ")}
        >
          <span>{o.icon}</span>
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
