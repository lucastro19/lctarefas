import { NavLink } from "react-router-dom";
import { useTaskStore } from "../../store/taskStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useTagStore } from "../../store/tagStore";

const ROUTE_TABS = {
  inbox:    { to: "/inbox",    icon: "📥", label: "Inbox" },
  today:    { to: "/today",    icon: "☀️", label: "Hoje" },
  upcoming: { to: "/upcoming", icon: "⏰", label: "Em Breve" },
  someday:  { to: "/someday",  icon: "🔮", label: "Depois" },
  logbook:  { to: "/logbook",  icon: "📋", label: "Histórico" },
  trash:    { to: "/trash",    icon: "🗑️", label: "Lixeira" },
  archive:  { to: "/archive",  icon: "📦", label: "Arquivo" },
};

export function MobileTabBar() {
  const { getInbox, getToday } = useTaskStore();
  const { openQuickEntry } = useUiStore();
  const { tabBarIds } = useSettingsStore();
  const { tags } = useTagStore();

  const counts = {
    inbox: getInbox().length,
    today: getToday().length,
  };

  const tabs = tabBarIds.map((id) => {
    if (id.startsWith("tag:")) {
      const tagId = id.slice(4);
      const tag = tags.find((t) => t.id === tagId);
      if (!tag) return null;
      return { to: `/tag/${tagId}`, icon: "🏷️", label: tag.name, id };
    }
    const route = ROUTE_TABS[id];
    if (!route) return null;
    return { ...route, id };
  }).filter(Boolean);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ to, icon, label, id }) => (
        <NavLink
          key={id}
          to={to}
          className={({ isActive }) => [
            "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0 relative",
            isActive ? "text-primary" : "text-text-secondary",
          ].join(" ")}
        >
          <span className="text-xl leading-none">{icon}</span>
          <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">{label}</span>
          {counts[id] > 0 && (
            <span className="absolute top-1 right-3 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {counts[id] > 99 ? "99" : counts[id]}
            </span>
          )}
        </NavLink>
      ))}

      {/* Botão + sempre presente */}
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
