import { useLocation } from "react-router-dom";
import { useUiStore } from "../../store/uiStore";

const PAGE_TITLES = {
  "/inbox":    "Inbox",
  "/today":    "Hoje",
  "/upcoming": "Em Breve",
  "/someday":  "Depois",
  "/calendar": "Calendário",
  "/logbook":  "Histórico",
  "/trash":    "Lixeira",
  "/archive":  "Arquivo",
};

export function MobileHeader() {
  const { pathname } = useLocation();
  const { openDrawer, openSearch } = useUiStore();

  const title = PAGE_TITLES[pathname] ?? "LCTarefas";

  return (
    <header
      className="md:hidden relative flex items-center px-2 bg-card border-b border-border shrink-0"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: "10px" }}
    >
      {/* Hamburger */}
      <button
        onClick={openDrawer}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-main hover:bg-bg transition-colors shrink-0"
        aria-label="Menu"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <rect y="0"  width="18" height="2" rx="1" fill="currentColor"/>
          <rect y="6"  width="13" height="2" rx="1" fill="currentColor"/>
          <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
        </svg>
      </button>

      {/* Título centralizado de forma absoluta */}
      <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
        <span className="text-[17px] font-semibold text-text-main tracking-tight">
          {title}
        </span>
      </div>

      {/* Search — empurrado para a direita */}
      <div className="flex-1" />
      <button
        onClick={openSearch}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-text-secondary hover:text-text-main hover:bg-bg transition-colors shrink-0"
        aria-label="Buscar"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
          <path d="M12 12.5L16 16.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
    </header>
  );
}
