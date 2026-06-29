import { NavLink } from "react-router-dom";
import { useTaskStore } from "../../store/taskStore";
import { useUiStore } from "../../store/uiStore";

const TABS = [
  { to: "/inbox",    icon: "📥", label: "Inbox" },
  { to: "/today",    icon: "☀️", label: "Hoje" },
  { to: "/upcoming", icon: "⏰", label: "Em Breve" },
  { to: "/someday",  icon: "🔮", label: "Algum Dia" },
];

export function MobileTabBar() {
  const { getInbox, getToday } = useTaskStore();
  const { openQuickEntry } = useUiStore();

  const counts = {
    "/inbox": getInbox().length,
    "/today": getToday().length,
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-stretch"
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => [
            "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0 relative",
            isActive ? "text-primary" : "text-text-secondary",
          ].join(" ")}
        >
          <span className="text-xl leading-none">{icon}</span>
          <span className="text-[10px] font-medium leading-none truncate">{label}</span>
          {counts[to] > 0 && (
            <span className="absolute top-1 right-3 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {counts[to] > 99 ? "99" : counts[to]}
            </span>
          )}
        </NavLink>
      ))}

      {/* Botão + central */}
      <button
        onClick={openQuickEntry}
        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-text-secondary transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-lg font-light leading-none mb-0.5">
          +
        </span>
        <span className="text-[10px] font-medium leading-none">Novo</span>
      </button>
    </nav>
  );
}
